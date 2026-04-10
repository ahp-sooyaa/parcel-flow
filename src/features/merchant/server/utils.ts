import "server-only";
import { z } from "zod";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

import type { AppAccessContext } from "@/features/auth/server/dto";

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

export const updateMerchantProfileSchema = z.object({
  merchantId: z.string().trim().uuid(),
  shopName: z.string().trim().min(2).max(120),
  pickupTownshipId: optionalNullableUuid(),
  defaultPickupAddress: optionalNullableTrimmedString(255),
  notes: optionalNullableTrimmedString(1000),
});

export function getMerchantResourceAccess(input: {
  viewer: Pick<AppAccessContext, "appUserId" | "roleSlug" | "permissions">;
  merchantAppUserId?: string;
}) {
  const { viewer, merchantAppUserId } = input;
  const isOwnMerchant =
    viewer.roleSlug === "merchant" &&
    typeof merchantAppUserId === "string" &&
    merchantAppUserId === viewer.appUserId;

  return {
    canViewList: viewer.permissions.includes("merchant-list.view"),
    canCreate: viewer.permissions.includes("user.create"),
    canView: viewer.permissions.includes("merchant.view") || isOwnMerchant,
    canUpdate: viewer.permissions.includes("merchant.update") || isOwnMerchant,
    canDelete: viewer.permissions.includes("merchant.delete"),
  };
}
