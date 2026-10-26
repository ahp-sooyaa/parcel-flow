import { z } from "zod";
import { maxLengthMessage, TEXT_LIMITS } from "@/lib/validation";

export const townshipInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Township name is required.")
    .max(TEXT_LIMITS.name, maxLengthMessage("Township name", TEXT_LIMITS.name)),
  baseFee: z.coerce.number().int().min(0),
  baseWeightKg: z.coerce.number().positive().default(3),
  extraWeightFee: z.coerce.number().int().min(0).default(0),
  extraWeightUnitKg: z.coerce.number().positive().default(1),
  volumetricDivisor: z.coerce.number().int().positive().default(5000),
  codFeePercent: z.coerce.number().min(0).default(0),
  returnFeePercent: z.coerce.number().min(0).default(100),
  isActive: z.coerce.boolean().default(true),
});

export const updateTownshipInputSchema = townshipInputSchema.extend({
  id: z.string().min(1),
});

export type TownshipListItemDto = {
  id: string;
  name: string;
  baseFee: number;
  baseWeightKg: number;
  extraWeightFee: number;
  extraWeightUnitKg: number;
  volumetricDivisor: number;
  codFeePercent: number;
  returnFeePercent: number;
  isActive: boolean;
};
