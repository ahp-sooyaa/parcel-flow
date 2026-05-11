"use server";

import { z } from "zod";

export const merchantContactSchema = z.object({
  merchantId: z.uuid(),
  townshipId: z.uuid(),
  recipientName: z.string().min(1),
  recipientPhoneNumber: z.string().min(5),
  recipientAddress: z.string().min(1),
});

export async function upsertMerchantContactAction(input: unknown) {
  return {
    ok: true,
    contact: merchantContactSchema.parse(input),
  };
}
