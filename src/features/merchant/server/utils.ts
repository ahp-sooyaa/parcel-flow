import "server-only";
import { z } from "zod";

import type { RoleSlug } from "@/db/constants";
import type { PermissionSlug } from "@/db/constants";

const merchantIdSchema = z.string().trim().uuid();

export function normalizeMerchantSearchQuery(raw: string | undefined) {
  return raw?.trim() ?? "";
}

export function toMerchantSearchPattern(query: string) {
  return `%${query.replaceAll("%", "").replaceAll("_", "")}%`;
}

export function isMerchantId(value: string) {
  return merchantIdSchema.safeParse(value).success;
}

export function canAccessMerchantResource(input: {
  viewerRoleSlug: RoleSlug;
  viewerAppUserId: string;
  merchantAppUserId: string;
  viewerPermissions?: readonly PermissionSlug[];
  permission?: PermissionSlug;
}) {
  if (input.permission && input.viewerPermissions?.includes(input.permission)) {
    return true;
  }

  if (input.viewerRoleSlug !== "merchant") {
    return false;
  }

  return input.merchantAppUserId === input.viewerAppUserId;
}
