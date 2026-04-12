import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import {
  toTownshipListItemDto,
  toTownshipOptionDto,
  type TownshipListItemDto,
  type TownshipOptionDto,
} from "./dto";
import { db } from "@/db";
import { townships } from "@/db/schema";
import { getTownshipAccess } from "@/features/auth/server/policies/townships";

import type { AppAccessContext } from "@/features/auth/server/dto";

async function listTownships(): Promise<TownshipListItemDto[]> {
  const rows = await db
    .select({
      id: townships.id,
      name: townships.name,
      isActive: townships.isActive,
      createdAt: townships.createdAt,
    })
    .from(townships)
    .orderBy(asc(townships.name), desc(townships.createdAt));

  return rows.map((row) => toTownshipListItemDto(row));
}

export async function getTownshipsListForViewer(
  viewer: Pick<AppAccessContext, "appUserId" | "roleSlug" | "permissions">,
): Promise<TownshipListItemDto[]> {
  const townshipAccess = getTownshipAccess(viewer);

  if (!townshipAccess.canViewList) {
    return [];
  }

  return listTownships();
}

export async function getTownshipOptions(
  input: { includeInactive?: boolean } = {},
): Promise<TownshipOptionDto[]> {
  const rows = await db
    .select({
      id: townships.id,
      name: townships.name,
    })
    .from(townships)
    .where(input.includeInactive ? undefined : eq(townships.isActive, true))
    .orderBy(asc(townships.name));

  return rows.map((row) => toTownshipOptionDto(row));
}

export async function createTownship(input: { name: string; isActive: boolean }) {
  const [created] = await db
    .insert(townships)
    .values({
      name: input.name,
      isActive: input.isActive,
    })
    .returning({ id: townships.id });

  return created;
}

export async function findTownshipById(id: string) {
  const [row] = await db
    .select({
      id: townships.id,
      name: townships.name,
      isActive: townships.isActive,
    })
    .from(townships)
    .where(eq(townships.id, id))
    .limit(1);

  if (!row) {
    return null;
  }

  return row;
}
