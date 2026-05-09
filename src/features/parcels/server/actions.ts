"use server";

import { z } from "zod";

import { parcelTypes } from "@/lib/domain";

export const createParcelSchema = z
  .object({
    merchantId: z.string().uuid(),
    merchantContactId: z.string().uuid().optional(),
    receiverName: z.string().min(1),
    receiverPhoneNumber: z.string().min(5),
    receiverAddress: z.string().min(1),
    townshipId: z.string().uuid(),
    parcelType: z.enum(parcelTypes),
    codAmount: z.coerce.number().int().min(0),
    deliveryFee: z.coerce.number().int().min(0),
    weightKg: z.coerce.number().positive().default(3),
    isLargeParcel: z.coerce.boolean().default(false),
    specialNotes: z.string().optional(),
  })
  .refine((value) => value.parcelType !== "cod" || value.codAmount > 0, {
    message: "COD amount is required for COD parcels.",
    path: ["codAmount"],
  });

export async function createParcelAction(input: unknown) {
  const payload = createParcelSchema.parse(input);

  return {
    ok: true,
    parcel: payload,
  };
}
