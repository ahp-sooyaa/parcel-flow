import "server-only";
import { z } from "zod";
import { YANGON_TOWNSHIPS } from "@/features/merchant/constants";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

import type { RoleSlug } from "@/db/constants";

export const createMerchantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phoneNumber: optionalNullableTrimmedString(30),
  address: z.string().trim().min(3).max(255),
  township: z.enum(YANGON_TOWNSHIPS),
  notes: optionalNullableTrimmedString(1000),
  linkedAppUserId: optionalNullableUuid(),
});

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

export function canAccessMerchantDetailScope(input: {
  viewerRoleSlug: RoleSlug;
  viewerAppUserId: string;
  merchantLinkedAppUserId: string | null;
}) {
  if (input.viewerRoleSlug !== "merchant") {
    return true;
  }

  return input.merchantLinkedAppUserId === input.viewerAppUserId;
}
