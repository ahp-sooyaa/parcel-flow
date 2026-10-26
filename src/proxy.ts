import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createContentSecurityPolicyRequestHeaders } from "@/lib/content-security-policy";
import { auth } from "@/lib/auth";
import { userRoles, type UserRole } from "@/lib/domain";
import { isDemoMode } from "@/lib/demo";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { getRoleLandingPath } from "@/lib/session";

function isWithinSection(pathname: string, section: string) {
  // Match whole path segments: "/dashboard/rider" must not match "/dashboard/rider-payouts".
  return pathname === section || pathname.startsWith(`${section}/`);
}

function canAccessDashboardPath(role: UserRole, pathname: string) {
  if (role === "super_admin") {
    return true;
  }

  const inMerchantSection = isWithinSection(pathname, "/dashboard/merchant");
  const inRiderSection = isWithinSection(pathname, "/dashboard/rider");

  if (role === "office_admin") {
    return !inMerchantSection && !inRiderSection;
  }

  if (role === "merchant") {
    return inMerchantSection || pathname === "/dashboard/settings";
  }

  return inRiderSection || pathname === "/dashboard/settings";
}

const sessionUserSchema = z.looseObject({
  role: z.enum(userRoles),
  isActive: z.boolean(),
});

// Server actions and demo logins are POSTs to page routes. One shared demo
// account per role means a single abusive visitor affects everyone, so cap
// mutations per IP. Normal clicking stays far below this.
const demoMutationLimiter = createRateLimiter({ capacity: 60, refillPerMinute: 60 });

function applyContentSecurityPolicy(request: NextRequest) {
  const { headers, contentSecurityPolicy } = createContentSecurityPolicyRequestHeaders(
    request.headers,
  );

  return {
    requestHeaders: headers,
    contentSecurityPolicy,
  };
}

function continueWithContentSecurityPolicy(
  request: NextRequest,
  requestHeaders: Headers,
  contentSecurityPolicy: string,
) {
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    isDemoMode() &&
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    !demoMutationLimiter.take(getClientIp(request.headers))
  ) {
    return new NextResponse("Too many requests. Slow down and try again in a minute.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }
  const { requestHeaders, contentSecurityPolicy } = applyContentSecurityPolicy(request);

  if (!pathname.startsWith("/dashboard")) {
    return continueWithContentSecurityPolicy(request, requestHeaders, contentSecurityPolicy);
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const userParseResult = sessionUserSchema.safeParse(session.user);

  if (!userParseResult.success || !userParseResult.data.isActive) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  const user = userParseResult.data;

  if (!canAccessDashboardPath(user.role, pathname)) {
    return NextResponse.redirect(new URL(getRoleLandingPath(user.role), request.url));
  }

  return continueWithContentSecurityPolicy(request, requestHeaders, contentSecurityPolicy);
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|monitoring).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
