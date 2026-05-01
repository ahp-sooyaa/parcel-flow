import "server-only";
import { z } from "zod";
import { optionalNullableUuid } from "@/lib/validation/zod-helpers";

const checkboxBoolean = z.preprocess((value) => value === "on" || value === "true", z.boolean());

export const addressBookRecipientContactSchema = z.object({
    merchantId: z.string().trim().uuid(),
    contactId: optionalNullableUuid(),
    contactLabel: z.string().trim().min(1).max(120),
    recipientName: z.string().trim().min(2).max(120),
    recipientPhone: z.string().trim().min(6).max(30),
    recipientTownshipId: z.string().trim().uuid(),
    recipientAddress: z.string().trim().min(3).max(255),
});

export const addressBookPickupLocationSchema = z.object({
    merchantId: z.string().trim().uuid(),
    pickupLocationId: optionalNullableUuid(),
    label: z.string().trim().min(1).max(120),
    townshipId: z.string().trim().uuid(),
    pickupAddress: z.string().trim().min(3).max(255),
    contactName: z.string().trim().min(2).max(120),
    contactPhone: z.string().trim().min(6).max(30),
    isDefault: checkboxBoolean,
});

export const addressBookDeleteSchema = z.object({
    merchantId: z.string().trim().uuid(),
    contactId: optionalNullableUuid(),
    pickupLocationId: optionalNullableUuid(),
});

export function normalizeAddressBookTab(raw: string | undefined) {
    return raw === "pickup-locations" ? "pickup-locations" : "recipient-contacts";
}

export function normalizeAddressBookQuery(raw: string | undefined) {
    return raw?.trim().replaceAll("%", "").replaceAll("_", "").trim() ?? "";
}
