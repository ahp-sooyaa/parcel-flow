import "server-only";
import { z } from "zod";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

import type { AppAccessContext } from "@/features/auth/server/dto";

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

export function getRiderResourceAccess(input: {
  viewer: Pick<AppAccessContext, "appUserId" | "roleSlug" | "permissions">;
  riderAppUserId?: string;
}) {
  const { viewer, riderAppUserId } = input;
  const isOwnRider = viewer.roleSlug === "rider" && riderAppUserId === viewer.appUserId;
  const canManageStatus = viewer.permissions.includes("rider.update");

  return {
    canViewList: viewer.permissions.includes("rider-list.view"),
    canCreate: viewer.permissions.includes("user.create"),
    canView: viewer.permissions.includes("rider.view") || isOwnRider,
    canUpdate: canManageStatus || isOwnRider,
    canManageStatus,
    canDelete: viewer.permissions.includes("rider.delete"),
  };
}
