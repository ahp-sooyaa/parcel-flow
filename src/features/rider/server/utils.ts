import "server-only";
import { z } from "zod";

import type { PermissionSlug, RoleSlug } from "@/db/constants";

const riderIdSchema = z.string().trim().uuid();

export function normalizeRiderSearchQuery(raw: string | undefined) {
  return raw?.trim() ?? "";
}

export function toRiderSearchPattern(query: string) {
  return `%${query.replaceAll("%", "").replaceAll("_", "")}%`;
}

export function isRiderId(value: string) {
  return riderIdSchema.safeParse(value).success;
}

export function canAccessRiderResource(input: {
  viewerRoleSlug: RoleSlug;
  viewerAppUserId: string;
  riderAppUserId: string;
  viewerPermissions?: readonly PermissionSlug[];
  permission?: PermissionSlug;
}) {
  if (input.permission && input.viewerPermissions?.includes(input.permission)) {
    return true;
  }

  if (input.viewerRoleSlug !== "rider") {
    return false;
  }

  return input.riderAppUserId === input.viewerAppUserId;
}
