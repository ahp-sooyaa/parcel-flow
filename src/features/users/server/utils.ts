import "server-only";
import { z } from "zod";
import { ROLE_SLUGS } from "@/db/constants";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

import type { PermissionSlug, RoleSlug } from "@/db/constants";

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phoneNumber: optionalNullableTrimmedString(30),
  role: z.enum(ROLE_SLUGS),
  isActive: z.boolean(),
  merchantShopName: optionalNullableTrimmedString(120),
  merchantPickupTownshipId: optionalNullableUuid(),
  merchantDefaultPickupAddress: optionalNullableTrimmedString(255),
  merchantNotes: optionalNullableTrimmedString(1000),
  riderTownshipId: optionalNullableUuid(),
  riderVehicleType: optionalNullableTrimmedString(50),
  riderLicensePlate: optionalNullableTrimmedString(50),
  riderNotes: optionalNullableTrimmedString(1000),
  riderIsActive: z.boolean(),
});

export const updateUserProfileSchema = z.object({
  userId: z.string().trim().uuid(),
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: optionalNullableTrimmedString(30),
});

export const softDeleteUserSchema = z.object({
  userId: z.string().trim().uuid(),
});

export type UserRoleEditAction = {
  href: string;
  label: string;
  permission: PermissionSlug;
};

export function getUserRoleEditAction(input: {
  roleSlug: RoleSlug;
  userId: string;
}): UserRoleEditAction | null {
  if (input.roleSlug === "merchant") {
    return {
      href: `/dashboard/merchants/${input.userId}/edit`,
      label: "Edit Merchant Profile",
      permission: "merchant.update",
    };
  }

  if (input.roleSlug === "rider") {
    return {
      href: `/dashboard/riders/${input.userId}/edit`,
      label: "Edit Rider Profile",
      permission: "rider.update",
    };
  }

  return null;
}

export function parseActiveFlag(raw: FormDataEntryValue | null) {
  return raw === "on" || raw === "true";
}
