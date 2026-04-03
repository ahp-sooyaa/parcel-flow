import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { canAccessDashboardPath } from "@/lib/auth/route-access";
import { getSupabasePublicEnv } from "@/lib/env";

import type { RoleSlug } from "@/db/constants";

type PermissionRow = {
  permission: { slug: string | null } | null;
};

type RoleRow = {
  slug: string | null;
  role_permissions: PermissionRow[] | PermissionRow | null;
};

type AppUserAccessRow = {
  id: string;
  is_active: boolean;
  must_reset_password: boolean;
  role: RoleRow | RoleRow[] | null;
};

type StubAccessContext = {
  authenticated: boolean;
  isActive: boolean;
  mustResetPassword: boolean;
  permissions: string[];
};

const isDev = process.env.NODE_ENV === "development";

function getContentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self'${isDev ? " 'unsafe-inline'" : " 'nonce-" + nonce + "'"} https:`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'self'",
    isDev ? "" : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ");
}

function applySecurityHeaders(response: NextResponse, contentSecurityPolicy: string) {
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "encrypted-media=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "microphone=()",
      "payment=()",
      "picture-in-picture=()",
      "publickey-credentials-get=()",
      "usb=()",
    ].join(", "),
  );
}

function buildSignInRedirect(request: NextRequest, contentSecurityPolicy: string) {
  const redirectUrl = new URL("/sign-in", request.url);
  redirectUrl.searchParams.set("next", request.nextUrl.pathname);

  const response = NextResponse.redirect(redirectUrl);
  applySecurityHeaders(response, contentSecurityPolicy);

  return response;
}

function redirectToDashboardPath(
  request: NextRequest,
  pathname: string,
  contentSecurityPolicy: string,
) {
  const response = NextResponse.redirect(new URL(pathname, request.url));
  applySecurityHeaders(response, contentSecurityPolicy);

  return response;
}

function getAccessDeniedResponse(
  request: NextRequest,
  context: StubAccessContext,
  contentSecurityPolicy: string,
) {
  if (context.mustResetPassword && request.nextUrl.pathname !== "/dashboard/profile") {
    return redirectToDashboardPath(request, "/dashboard/profile", contentSecurityPolicy);
  }

  if (request.nextUrl.pathname !== "/dashboard") {
    return redirectToDashboardPath(request, "/dashboard", contentSecurityPolicy);
  }

  return buildSignInRedirect(request, contentSecurityPolicy);
}

function getStubbedAccessContext(request: NextRequest): StubAccessContext | null {
  if (process.env.AUTH_E2E_STUB_MODE !== "1") {
    return null;
  }

  const raw = request.headers.get("x-parcel-flow-e2e-auth");

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StubAccessContext>;

    return {
      authenticated: parsed.authenticated === true,
      isActive: parsed.isActive === true,
      mustResetPassword: parsed.mustResetPassword === true,
      permissions: Array.isArray(parsed.permissions)
        ? parsed.permissions.filter((value): value is string => typeof value === "string")
        : [],
    };
  } catch {
    return {
      authenticated: false,
      isActive: false,
      mustResetPassword: false,
      permissions: [],
    };
  }
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function extractPermissionSlugs(appUser: AppUserAccessRow) {
  const role = toArray(appUser.role)[0];
  const slugs = new Set<string>();

  if (!role) {
    return [];
  }

  for (const row of toArray(role.role_permissions)) {
    const slug = row.permission?.slug;

    if (slug) {
      slugs.add(slug);
    }
  }

  return Array.from(slugs);
}

function extractRoleSlug(appUser: AppUserAccessRow): RoleSlug | undefined {
  const role = toArray(appUser.role)[0];

  if (
    role?.slug === "super_admin" ||
    role?.slug === "office_admin" ||
    role?.slug === "rider" ||
    role?.slug === "merchant"
  ) {
    return role.slug;
  }

  return undefined;
}

function isDashboardPath(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = getContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  if (!isDashboardPath(request.nextUrl.pathname)) {
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    applySecurityHeaders(response, contentSecurityPolicy);

    return response;
  }

  const stubbedContext = getStubbedAccessContext(request);

  if (stubbedContext) {
    if (!stubbedContext.authenticated || !stubbedContext.isActive) {
      return buildSignInRedirect(request, contentSecurityPolicy);
    }

    const allowed = canAccessDashboardPath(request.nextUrl.pathname, {
      permissions: stubbedContext.permissions,
      isActive: stubbedContext.isActive,
      mustResetPassword: stubbedContext.mustResetPassword,
    });

    if (!allowed) {
      return getAccessDeniedResponse(request, stubbedContext, contentSecurityPolicy);
    }

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    applySecurityHeaders(response, contentSecurityPolicy);

    return response;
  }

  const createNextResponse = () => {
    const nextResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    applySecurityHeaders(nextResponse, contentSecurityPolicy);

    return nextResponse;
  };

  let response = createNextResponse();
  const supabaseEnv = getSupabasePublicEnv();

  const supabase = createServerClient(
    supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    supabaseEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = createNextResponse();

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;

  if (claimsError || !userId) {
    return buildSignInRedirect(request, contentSecurityPolicy);
  }

  const { data: appUser, error } = await supabase
    .from("app_users")
    .select(`
      is_active,
      must_reset_password,
      id,
      role:role_id (
        slug,
        role_permissions (
          permission:permission_id ( slug )
        )
      )
    `)
    .eq("supabase_user_id", userId)
    .maybeSingle<AppUserAccessRow>();

  if (error || !appUser?.is_active) {
    return buildSignInRedirect(request, contentSecurityPolicy);
  }

  const allowed = canAccessDashboardPath(request.nextUrl.pathname, {
    permissions: extractPermissionSlugs(appUser),
    isActive: appUser.is_active,
    mustResetPassword: appUser.must_reset_password,
    appUserId: appUser.id,
    roleSlug: extractRoleSlug(appUser),
  });

  if (!allowed) {
    return getAccessDeniedResponse(
      request,
      {
        authenticated: true,
        isActive: appUser.is_active,
        mustResetPassword: appUser.must_reset_password,
        permissions: extractPermissionSlugs(appUser),
      },
      contentSecurityPolicy,
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
