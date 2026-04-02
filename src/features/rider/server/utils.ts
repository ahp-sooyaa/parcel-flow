import "server-only";
import { z } from "zod";
import { YANGON_TOWNSHIPS } from "@/features/merchant/constants";

export const RIDER_CODE_REGEX = /^RDR-\d{4}$/;

export const createRiderSchema = z.object({
  riderCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(RIDER_CODE_REGEX, "Rider code must follow RDR-XXXX format."),
  fullName: z.string().trim().min(2).max(120),
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

export function normalizeRiderSearchQuery(raw: string | undefined) {
  return raw?.trim() ?? "";
}

export function toRiderSearchPattern(query: string) {
  return `%${query.replaceAll("%", "").replaceAll("_", "")}%`;
}
