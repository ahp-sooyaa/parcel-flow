import { z } from "zod";
import { maxLengthMessage, TEXT_LIMITS } from "@/lib/validation";

export const upsertRiderInputSchema = z.object({
  userId: z.uuid().optional(),
  name: z.string().min(1).max(TEXT_LIMITS.name, maxLengthMessage("Name", TEXT_LIMITS.name)),
  age: z.coerce.number().int().positive().optional(),
  address: z
    .string()
    .min(1)
    .max(TEXT_LIMITS.address, maxLengthMessage("Address", TEXT_LIMITS.address)),
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
