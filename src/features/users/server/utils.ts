import "server-only";
import { z } from "zod";
import { ROLE_SLUGS } from "@/db/constants";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

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
