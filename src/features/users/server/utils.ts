import "server-only";
import { z } from "zod";
import { ROLE_SLUGS } from "@/db/constants";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

import type { AppAccessContext } from "@/features/auth/server/dto";

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

export const updateAccountProfileSchema = z.object({
  targetUserId: optionalNullableUuid(),
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: optionalNullableTrimmedString(30),
});

export const changePasswordSchema = z
  .object({
    password: z.string().min(12),
    confirmPassword: z.string().min(12),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const softDeleteUserSchema = z.object({
  userId: z.string().trim().uuid(),
});

export function parseActiveFlag(raw: FormDataEntryValue | null) {
  return raw === "on" || raw === "true";
}

export function getUserResourceAccess(input: { viewer: Pick<AppAccessContext, "permissions"> }) {
  const { viewer } = input;

  return {
    canViewList: viewer.permissions.includes("user-list.view"),
    canCreate: viewer.permissions.includes("user.create"),
    canView: viewer.permissions.includes("user.view"),
    canUpdate: viewer.permissions.includes("user.update"),
    canDelete: viewer.permissions.includes("user.delete"),
    canResetPassword: viewer.permissions.includes("user-password.reset"),
  };
}
