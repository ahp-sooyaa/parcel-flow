import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { canAccessDashboardPath } from "@/lib/auth/route-access";
import { getSupabasePublicEnv } from "@/lib/env";

type PermissionRow = {
  permission: { slug: string | null } | null;
};

type RoleRow = {
  role_permissions: PermissionRow[] | PermissionRow | null;
};

type AppUserAccessRow = {
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

function buildSignInRedirect(request: NextRequest) {
  const redirectUrl = new URL("/sign-in", request.url);
  redirectUrl.searchParams.set("next", request.nextUrl.pathname);

  return NextResponse.redirect(redirectUrl);
}

function redirectToDashboardPath(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

function getAccessDeniedResponse(request: NextRequest, context: StubAccessContext) {
  if (context.mustResetPassword && request.nextUrl.pathname !== "/dashboard/profile") {
    return redirectToDashboardPath(request, "/dashboard/profile");
  }

  if (request.nextUrl.pathname !== "/dashboard") {
    return redirectToDashboardPath(request, "/dashboard");
  }

  return buildSignInRedirect(request);
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

export async function proxy(request: NextRequest) {
  const stubbedContext = getStubbedAccessContext(request);

  if (stubbedContext) {
    if (!stubbedContext.authenticated || !stubbedContext.isActive) {
      return buildSignInRedirect(request);
    }

    const allowed = canAccessDashboardPath(request.nextUrl.pathname, {
      permissions: stubbedContext.permissions,
      isActive: stubbedContext.isActive,
      mustResetPassword: stubbedContext.mustResetPassword,
    });

    if (!allowed) {
      return getAccessDeniedResponse(request, stubbedContext);
    }

    return NextResponse.next({ request });
  }

  const response = NextResponse.next({ request });
  const supabaseEnv = getSupabasePublicEnv();

  const supabase = createServerClient(
    supabaseEnv.NEXT_PUBLIC_SUPABASE_URL,
    supabaseEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return buildSignInRedirect(request);
  }

  const { data: appUser, error } = await supabase
    .from("app_users")
    .select(`
      is_active,
      must_reset_password,
      role:role_id (
        role_permissions (
          permission:permission_id ( slug )
        )
      )
    `)
    .eq("supabase_user_id", user.id)
    .maybeSingle<AppUserAccessRow>();

  if (error || !appUser || !appUser.is_active) {
    return buildSignInRedirect(request);
  }

  const allowed = canAccessDashboardPath(request.nextUrl.pathname, {
    permissions: extractPermissionSlugs(appUser),
    isActive: appUser.is_active,
    mustResetPassword: appUser.must_reset_password,
  });

  if (!allowed) {
    return getAccessDeniedResponse(request, {
      authenticated: true,
      isActive: appUser.is_active,
      mustResetPassword: appUser.must_reset_password,
      permissions: extractPermissionSlugs(appUser),
    });
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
