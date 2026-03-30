import "server-only";
import { cache } from "react";
import { findCurrentUserContextBySupabaseUserId } from "./dal";
import { PERMISSION_SLUGS, type PermissionSlug } from "@/db/constants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const resetRequiredPermissionAllowlist = new Set<PermissionSlug>([
  "dashboard-page.view",
  "password.change",
]);

export const getCurrentUserContext = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return findCurrentUserContextBySupabaseUserId(user.id);
});

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

  const currentUser = await getCurrentUserContext();

  if (!currentUser || !currentUser.isActive) {
    throw new Error("Unauthorized");
  }

  if (currentUser.mustResetPassword && !resetRequiredPermissionAllowlist.has(permission)) {
    throw new Error("Password reset required before this action is allowed");
  }

  if (!hasPermission(currentUser.permissions, permission)) {
    throw new Error("Forbidden");
  }

  return currentUser;
}
