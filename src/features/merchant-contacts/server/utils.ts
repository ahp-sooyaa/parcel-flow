import "server-only";
import { z } from "zod";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

const checkboxBoolean = z.preprocess((value) => value === "on" || value === "true", z.boolean());

export const merchantContactSearchSchema = z.object({
    merchantId: z.string().trim().uuid(),
    query: z.string().trim().max(120).default(""),
});

export const merchantContactReferenceSchema = z.object({
    selectedMerchantContactId: optionalNullableUuid(),
    contactLabel: optionalNullableTrimmedString(120),
    saveRecipientContact: checkboxBoolean,
});

export type MerchantContactSearchInput = z.infer<typeof merchantContactSearchSchema>;
export type MerchantContactReferenceInput = z.infer<typeof merchantContactReferenceSchema>;

export function normalizeMerchantContactLabel(label: string) {
    return label.trim().toLowerCase();
}

export function toMerchantContactSearchPattern(raw: string) {
    const normalized = raw.trim().replaceAll("%", "").replaceAll("_", "");

    return normalized ? `%${normalized}%` : null;
}
