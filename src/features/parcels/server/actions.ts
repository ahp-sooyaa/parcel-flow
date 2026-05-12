"use server";

import { z } from "zod";

import { parcelTypes } from "@/lib/domain";

const createParcelSchema = z
  .object({
    merchantId: z.uuid(),
    merchantContactId: z.uuid().optional(), // remove this, decided not to add contact feature
    receiverName: z.string().min(1),
    receiverPhoneNumber: z.string().min(5),
    receiverAddress: z.string().min(1),
    townshipId: z.uuid(),
    parcelType: z.enum(parcelTypes), // if 'cash on delivery' checkbox is checked, this one will be cod
    codAmount: z.coerce.number().int().min(0), // if cod type, cod field is required.
    deliveryFee: z.coerce.number().int().min(0),
    weightKg: z.coerce.number().positive().default(3),
    isLargeParcel: z.coerce.boolean().default(false), // remove this, we will default value to weight_kg, parcel_width, parcel_height, parcel_length both in form field and database
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
