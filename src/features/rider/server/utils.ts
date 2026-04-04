import "server-only";
import { z } from "zod";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

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

export const updateRiderProfileSchema = z.object({
  riderId: z.string().trim().uuid(),
  townshipId: optionalNullableUuid(),
  vehicleType: z.string().trim().min(2).max(50),
  licensePlate: optionalNullableTrimmedString(50),
  notes: optionalNullableTrimmedString(1000),
});

export function parseActiveFlag(raw: FormDataEntryValue | null) {
  return raw === "on" || raw === "true";
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
