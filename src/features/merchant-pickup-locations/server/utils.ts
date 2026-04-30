import "server-only";
import { z } from "zod";
import { optionalNullableUuid } from "@/lib/validation/zod-helpers";

export const merchantPickupLocationSearchSchema = z.object({
    merchantId: z.string().trim().uuid(),
    query: z.string().trim().max(120).default(""),
});

const checkboxBoolean = z.preprocess((value) => value === "on" || value === "true", z.boolean());

export const pickupLocationReferenceSchema = z.object({
    pickupLocationId: optionalNullableUuid(),
    pickupLocationLabel: z.string().trim().min(1).max(120),
    pickupTownshipId: z.string().trim().uuid(),
    pickupAddress: z.string().trim().min(3).max(255),
    savePickupLocation: checkboxBoolean,
});

export type MerchantPickupLocationSearchInput = z.infer<typeof merchantPickupLocationSearchSchema>;

export function normalizeMerchantPickupLocationLabel(label: string) {
    return label.trim().toLowerCase();
}

export function toMerchantPickupLocationSearchPattern(raw: string) {
    const normalized = raw.trim().replaceAll("%", "").replaceAll("_", "");

    return normalized ? `%${normalized}%` : null;
}
