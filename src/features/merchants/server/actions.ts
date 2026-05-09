"use server";

import { z } from "zod";

export const merchantSchema = z.object({
  userId: z.string().uuid().optional(),
  shopName: z.string().min(1),
  address: z.string().min(1),
});

export async function upsertMerchantAction(input: unknown) {
  return {
    ok: true,
    merchant: merchantSchema.parse(input),
  };
}
