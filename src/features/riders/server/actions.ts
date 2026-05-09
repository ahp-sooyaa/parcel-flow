"use server";

import { z } from "zod";

export const riderSchema = z.object({
  userId: z.string().uuid().optional(),
  name: z.string().min(1),
  age: z.coerce.number().int().positive().optional(),
  address: z.string().min(1),
  townshipIds: z.array(z.string().uuid()).default([]),
});

export async function upsertRiderAction(input: unknown) {
  return {
    ok: true,
    rider: riderSchema.parse(input),
  };
}
