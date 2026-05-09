"use server";

import { z } from "zod";

export const townshipSchema = z.object({
  name: z.string().min(1),
  baseFee: z.coerce.number().int().min(0),
  baseWeightKg: z.coerce.number().positive().default(3),
  extraWeightFee: z.coerce.number().int().min(0).default(0),
  extraWeightUnitKg: z.coerce.number().positive().default(1),
  volumetricDivisor: z.coerce.number().int().positive().default(5000),
  codFeePercent: z.coerce.number().min(0).default(0),
  returnFeePercent: z.coerce.number().min(0).default(100),
  isActive: z.coerce.boolean().default(true),
});

export async function upsertTownshipAction(input: unknown) {
  return {
    ok: true,
    township: townshipSchema.parse(input),
  };
}
