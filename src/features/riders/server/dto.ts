import { z } from "zod";

export const upsertRiderInputSchema = z.object({
  userId: z.uuid().optional(),
  name: z.string().min(1),
  age: z.coerce.number().int().positive().optional(),
  address: z.string().min(1),
  townshipIds: z.array(z.uuid()).default([]),
});

export type RiderListItemDto = {
  id: string;
  name: string;
  phoneNumber: string;
  serviceTownships: string[];
  expectedCollection: number;
  actualCollection: number;
  activeParcelCount: number;
};

export type RiderOptionDto = {
  id: string;
  name: string;
  phoneNumber: string;
  serviceTownships: string[];
  expectedCollection: number;
};
