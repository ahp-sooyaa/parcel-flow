import { eq, asc } from "drizzle-orm";
import type { z } from "zod";

import { db } from "@/db";
import { townships } from "@/db/schema";
import type { TownshipListItemDto, townshipInputSchema } from "@/features/townships/server/dto";

type TownshipInput = z.infer<typeof townshipInputSchema>;

function mapTownship(row: typeof townships.$inferSelect): TownshipListItemDto {
  return {
    id: row.id,
    name: row.name,
    baseFee: row.baseFee,
    baseWeightKg: Number(row.baseWeightKg),
    extraWeightFee: row.extraWeightFee,
    extraWeightUnitKg: Number(row.extraWeightUnitKg),
    volumetricDivisor: row.volumetricDivisor,
    codFeePercent: Number(row.codFeePercent),
    returnFeePercent: Number(row.returnFeePercent),
    isActive: row.isActive,
  };
}

export async function listTownships() {
  const rows = await db.select().from(townships).orderBy(asc(townships.name));

  return rows.map(mapTownship);
}

export async function listActiveTownships() {
  const rows = await db
    .select()
    .from(townships)
    .where(eq(townships.isActive, true))
    .orderBy(asc(townships.name));

  return rows.map(mapTownship);
}

export async function createTownship(input: TownshipInput) {
  const [row] = await db
    .insert(townships)
    .values({
      name: input.name,
      baseFee: input.baseFee,
      baseWeightKg: String(input.baseWeightKg),
      extraWeightFee: input.extraWeightFee,
      extraWeightUnitKg: String(input.extraWeightUnitKg),
      volumetricDivisor: input.volumetricDivisor,
      codFeePercent: String(input.codFeePercent),
      returnFeePercent: String(input.returnFeePercent),
      isActive: input.isActive,
    })
    .returning();

  return mapTownship(row);
}

export async function updateTownship(id: string, input: TownshipInput) {
  const [row] = await db
    .update(townships)
    .set({
      name: input.name,
      baseFee: input.baseFee,
      baseWeightKg: String(input.baseWeightKg),
      extraWeightFee: input.extraWeightFee,
      extraWeightUnitKg: String(input.extraWeightUnitKg),
      volumetricDivisor: input.volumetricDivisor,
      codFeePercent: String(input.codFeePercent),
      returnFeePercent: String(input.returnFeePercent),
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(eq(townships.id, id))
    .returning();

  return row ? mapTownship(row) : null;
}
