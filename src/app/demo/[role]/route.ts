import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { DEMO_ACCOUNTS, isDemoMode, isDemoRole } from "@/lib/demo";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { getRoleLandingPath } from "@/lib/session";

const demoLoginLimiter = createRateLimiter({ capacity: 10, refillPerMinute: 5 });

// POST only, so link prefetching and crawlers never create sessions.
export async function POST(request: Request, ctx: RouteContext<"/demo/[role]">) {
  if (!isDemoMode()) {
    return new NextResponse(null, { status: 404 });
  }

  const { role } = await ctx.params;

  if (!isDemoRole(role)) {
    return new NextResponse(null, { status: 404 });
  }

  if (!demoLoginLimiter.take(getClientIp(request.headers))) {
    return new NextResponse("Too many demo logins. Try again in a minute.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const account = DEMO_ACCOUNTS[role];

  try {
    const { headers } = await auth.api.signInUsername({
      body: { username: account.username, password: account.password },
      headers: request.headers,
      returnHeaders: true,
    });

    // 303 turns the form POST into a GET of the landing page.
    const response = NextResponse.redirect(
      new URL(getRoleLandingPath(account.role), request.url),
      303,
    );

    for (const cookie of headers.getSetCookie()) {
      response.headers.append("Set-Cookie", cookie);
    }

    return response;
  } catch (error) {
    Sentry.withScope((scope) => {
      scope.setTag("auth.flow", "demo-login");
      scope.setContext("demo", { role });
      Sentry.captureException(error);
    });

    return NextResponse.redirect(new URL("/login", request.url), 303);
  }
}
