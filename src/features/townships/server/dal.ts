import "server-only";
import { asc, desc, eq, ilike } from "drizzle-orm";
import {
    toTownshipListItemDto,
    toTownshipOptionDto,
    type TownshipListItemDto,
    type TownshipOptionDto,
} from "./dto";
import { normalizeTownshipSearchQuery } from "./utils";
import { db } from "@/db";
import { townships } from "@/db/schema";
import { getTownshipAccess } from "@/features/auth/server/policies/townships";

import type { AppAccessViewer } from "@/features/auth/server/dto";

async function listTownships(
    input: {
        query?: string;
    } = {},
): Promise<TownshipListItemDto[]> {
    const normalizedQuery = normalizeTownshipSearchQuery(input.query);
    const searchPattern = normalizedQuery
        ? `%${normalizedQuery.replaceAll("%", "").replaceAll("_", "")}%`
        : null;
    const rows = await db
        .select({
            id: townships.id,
            name: townships.name,
            isActive: townships.isActive,
            createdAt: townships.createdAt,
        })
        .from(townships)
        .where(searchPattern ? ilike(townships.name, searchPattern) : undefined)
        .orderBy(asc(townships.name), desc(townships.createdAt));

    return rows.map((row) => toTownshipListItemDto(row));
}

export async function getTownshipsListForViewer(
    viewer: AppAccessViewer,
    input: {
        query?: string;
    } = {},
): Promise<TownshipListItemDto[]> {
    const townshipAccess = getTownshipAccess(viewer);

    if (!townshipAccess.canViewList) {
        return [];
    }

    return listTownships(input);
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

export async function updateTownship(input: {
    townshipId: string;
    name: string;
    isActive: boolean;
}) {
    const [updated] = await db
        .update(townships)
        .set({
            name: input.name,
            isActive: input.isActive,
            updatedAt: new Date(),
        })
        .where(eq(townships.id, input.townshipId))
        .returning({ id: townships.id });

    return updated ?? null;
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
