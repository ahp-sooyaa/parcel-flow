import "server-only";
import { z } from "zod";
import { YANGON_TOWNSHIPS } from "@/features/merchant/constants";

import type { RoleSlug } from "@/db/constants";

export const createMerchantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phoneNumber: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() !== "" ? value : undefined),
      z.string().trim().max(30).optional(),
    )
    .transform((value) => value ?? null),
  address: z.string().trim().min(3).max(255),
  township: z.enum(YANGON_TOWNSHIPS),
  notes: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() !== "" ? value : undefined),
      z.string().trim().max(1000).optional(),
    )
    .transform((value) => value ?? null),
  linkedAppUserId: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() !== "" ? value : undefined),
      z.string().trim().uuid().optional(),
    )
    .transform((value) => value ?? null),
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
