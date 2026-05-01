import "server-only";
import { z } from "zod";
import { optionalNullableTrimmedString } from "@/lib/validation/zod-helpers";

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
    notes: optionalNullableTrimmedString(1000),
});
