"use server";

import { z } from "zod";

import { canManageTownshipPricing } from "@/lib/permissions";
import { requireCurrentUser } from "@/lib/session";

export const townshipSchema = z.object({
  name: z.string().trim().min(1, "Township name is required."),
  baseFee: z.coerce.number().int().min(0),
  baseWeightKg: z.coerce.number().positive().default(3),
  extraWeightFee: z.coerce.number().int().min(0).default(0),
  extraWeightUnitKg: z.coerce.number().positive().default(1),
  volumetricDivisor: z.coerce.number().int().positive().default(5000),
  codFeePercent: z.coerce.number().min(0).default(0),
  returnFeePercent: z.coerce.number().min(0).default(100),
  isActive: z.coerce.boolean().default(true),
});

const updateTownshipSchema = townshipSchema.extend({
  id: z.string().min(1),
});

export async function createTownshipAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parsedInput = townshipSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false as const,
      message: parsedInput.error.issues[0]?.message ?? "Invalid township pricing details.",
    };
  }

  if (!canManageTownshipPricing(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to manage township pricing.",
    };
  }

  return {
    ok: true as const,
    message: "Township pricing validated.",
    township: parsedInput.data,
  };
}

export async function updateTownshipAction(input: unknown) {
  const actor = await requireCurrentUser();
  const parsedInput = updateTownshipSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false as const,
      message: parsedInput.error.issues[0]?.message ?? "Invalid township pricing details.",
    };
  }

  if (!canManageTownshipPricing(actor.role)) {
    return {
      ok: false as const,
      message: "You do not have permission to manage township pricing.",
    };
  }

  return {
    ok: true as const,
    message: "Township pricing validated.",
    township: parsedInput.data,
  };
}
