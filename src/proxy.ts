import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createContentSecurityPolicyRequestHeaders } from "@/lib/content-security-policy";
import { auth } from "@/lib/auth";
import { userRoles, type UserRole } from "@/lib/domain";
import { getRoleLandingPath } from "@/lib/session";

function canAccessDashboardPath(role: UserRole, pathname: string) {
  if (role === "super_admin") {
    return true;
  }

  if (role === "office_admin") {
    return !pathname.startsWith("/dashboard/merchant") && !pathname.startsWith("/dashboard/rider");
  }

  if (role === "merchant") {
    return pathname.startsWith("/dashboard/merchant") || pathname === "/dashboard/settings";
  }

  return pathname.startsWith("/dashboard/rider") || pathname === "/dashboard/settings";
}

const sessionUserSchema = z.looseObject({
  role: z.enum(userRoles),
  isActive: z.boolean(),
});

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
