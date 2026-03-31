import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { findCurrentUserContextBySupabaseUserId } from "./dal";
import { PERMISSION_SLUGS, type PermissionSlug, type RoleSlug } from "@/db/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const roleLabelBySlug: Record<RoleSlug, string> = {
  super_admin: "Super Admin",
  office_admin: "Office Admin",
  rider: "Rider",
  merchant: "Merchant",
};

type StubAccessContext = {
  authenticated: boolean;
  isActive: boolean;
  mustResetPassword: boolean;
  permissions: string[];
  roleSlug?: RoleSlug;
};

async function getStubbedCurrentUserContext() {
  if (process.env.AUTH_E2E_STUB_MODE !== "1") {
    return null;
  }

  const requestHeaders = await headers();
  const raw = requestHeaders.get("x-parcel-flow-e2e-auth");

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StubAccessContext>;
    const roleSlug: RoleSlug =
      parsed.roleSlug && roleLabelBySlug[parsed.roleSlug] ? parsed.roleSlug : "office_admin";

    if (parsed.authenticated !== true) {
      return null;
    }

    return {
      appUserId: "e2e-app-user",
      supabaseUserId: "e2e-supabase-user",
      fullName: "E2E Test User",
      email: "e2e-user@example.com",
      phoneNumber: null,
      role: {
        id: `e2e-${roleSlug}`,
        slug: roleSlug,
        label: roleLabelBySlug[roleSlug],
      },
      isActive: parsed.isActive === true,
      mustResetPassword: parsed.mustResetPassword === true,
      permissions: Array.isArray(parsed.permissions)
        ? parsed.permissions.filter((value): value is PermissionSlug =>
            PERMISSION_SLUGS.includes(value as PermissionSlug),
          )
        : [],
    };
  } catch {
    return null;
  }
}

export const getCurrentUserContext = cache(async () => {
  const stubbed = await getStubbedCurrentUserContext();

  if (stubbed) {
    return stubbed;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return findCurrentUserContextBySupabaseUserId(user.id);
});

export async function requireCurrentUser() {
  const currentUser = await getCurrentUserContext();

  if (!currentUser?.isActive) {
    throw new Error("Unauthorized");
  }

  return currentUser;
}

export function hasPermission(
  userPermissions: readonly string[],
  permission: PermissionSlug,
): boolean {
  return userPermissions.includes(permission);
}

export async function requirePermission(permission: PermissionSlug) {
  if (!PERMISSION_SLUGS.includes(permission)) {
    throw new Error(`Unknown permission: ${permission}`);
  }

  const currentUser = await requireCurrentUser();

  if (currentUser.mustResetPassword && permission !== "dashboard-page.view") {
    throw new Error("Password reset required before this action is allowed");
  }

  if (!hasPermission(currentUser.permissions, permission)) {
    throw new Error("Forbidden");
  }

  return currentUser;
}
