import "server-only";
import { z } from "zod";
import { YANGON_TOWNSHIPS } from "@/features/merchant/constants";
import { optionalNullableTrimmedString, optionalNullableUuid } from "@/lib/validation/zod-helpers";

export const RIDER_CODE_REGEX = /^RDR-\d{4}$/;

export const createRiderSchema = z.object({
  riderCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(RIDER_CODE_REGEX, "Rider code must follow RDR-XXXX format."),
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: optionalNullableTrimmedString(30),
  address: z.string().trim().min(3).max(255),
  township: z.enum(YANGON_TOWNSHIPS),
  notes: optionalNullableTrimmedString(1000),
  linkedAppUserId: optionalNullableUuid(),
});

export function normalizeRiderSearchQuery(raw: string | undefined) {
  return raw?.trim() ?? "";
}

export function toRiderSearchPattern(query: string) {
  return `%${query.replaceAll("%", "").replaceAll("_", "")}%`;
}
