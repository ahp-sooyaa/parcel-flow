import "server-only";
import { and, asc, desc, eq, ilike, isNull, or } from "drizzle-orm";
import {
    toRiderDetailDto,
    toRiderListItemDto,
    toRiderProfileDto,
    type RiderDetailDto,
    type RiderListItemDto,
    type RiderProfileDto,
} from "./dto";
import { isRiderId, normalizeRiderSearchQuery, toRiderSearchPattern } from "./utils";
import { db, type DbClient } from "@/db";
import { appUsers, riders, townships } from "@/db/schema";
import { getRiderAccess } from "@/features/auth/server/policies/rider";

import type { AppAccessViewer } from "@/features/auth/server/dto";

type RiderWriteClient = Pick<DbClient, "insert">;

async function listRiders(
    input: {
        query?: string;
        limit?: number;
    } = {},
): Promise<RiderListItemDto[]> {
    const normalizedQuery = normalizeRiderSearchQuery(input.query);
    const safeLimit = Number.isInteger(input.limit)
        ? Math.min(Math.max(input.limit ?? 50, 1), 200)
        : 50;
    const searchPattern = normalizedQuery ? toRiderSearchPattern(normalizedQuery) : null;

    const rows = await db
        .select({
            id: riders.appUserId,
            fullName: appUsers.fullName,
            phoneNumber: appUsers.phoneNumber,
            townshipName: townships.name,
            vehicleType: riders.vehicleType,
            licensePlate: riders.licensePlate,
            isActive: riders.isActive,
            notes: riders.notes,
            createdAt: riders.createdAt,
        })
        .from(riders)
        .innerJoin(appUsers, eq(riders.appUserId, appUsers.id))
        .leftJoin(townships, eq(riders.townshipId, townships.id))
        .where(
            and(
                isNull(riders.deletedAt),
                isNull(appUsers.deletedAt),
                searchPattern
                    ? or(
                          ilike(appUsers.fullName, searchPattern),
                          ilike(appUsers.phoneNumber, searchPattern),
                          ilike(riders.vehicleType, searchPattern),
                          ilike(riders.licensePlate, searchPattern),
                      )
                    : undefined,
            ),
        )
        .orderBy(asc(appUsers.fullName), desc(riders.createdAt))
        .limit(safeLimit);

    return rows.map((row) => toRiderListItemDto(row));
}

export async function getRidersListForViewer(
    viewer: AppAccessViewer,
    input: {
        query?: string;
        limit?: number;
    } = {},
): Promise<RiderListItemDto[]> {
    const riderAccess = getRiderAccess({ viewer });

    if (!riderAccess.canViewList) {
        return [];
    }

    return listRiders(input);
}

export async function createRiderProfile(input: {
    appUserId: string;
    townshipId: string | null;
    vehicleType: string;
    licensePlate: string | null;
    isActive: boolean;
    notes: string | null;
    dbClient?: RiderWriteClient;
}) {
    const client = input.dbClient ?? db;
    const [created] = await client
        .insert(riders)
        .values({
            appUserId: input.appUserId,
            townshipId: input.townshipId,
            vehicleType: input.vehicleType,
            licensePlate: input.licensePlate,
            isActive: input.isActive,
            notes: input.notes,
        })
        .returning({ id: riders.appUserId });

    return created;
}

async function findRiderProfileByAppUserId(appUserId: string): Promise<RiderProfileDto | null> {
    if (!isRiderId(appUserId)) {
        return null;
    }

    const [row] = await db
        .select({
            appUserId: riders.appUserId,
            townshipId: riders.townshipId,
            vehicleType: riders.vehicleType,
            licensePlate: riders.licensePlate,
            isActive: riders.isActive,
            notes: riders.notes,
            createdAt: riders.createdAt,
            updatedAt: riders.updatedAt,
        })
        .from(riders)
        .where(and(eq(riders.appUserId, appUserId), isNull(riders.deletedAt)))
        .limit(1);

    if (!row) {
        return null;
    }

    return toRiderProfileDto(row);
}

export async function getRiderProfileByAppUserIdForViewer(
    viewer: AppAccessViewer,
    appUserId: string,
): Promise<RiderProfileDto | null> {
    const riderAccess = getRiderAccess({
        viewer,
        riderAppUserId: appUserId,
    });

    if (!riderAccess.canView) {
        return null;
    }

    return findRiderProfileByAppUserId(appUserId);
}

async function findRiderById(riderId: string): Promise<RiderDetailDto | null> {
    if (!isRiderId(riderId)) {
        return null;
    }

    const [row] = await db
        .select({
            id: riders.appUserId,
            fullName: appUsers.fullName,
            email: appUsers.email,
            phoneNumber: appUsers.phoneNumber,
            townshipId: riders.townshipId,
            townshipName: townships.name,
            vehicleType: riders.vehicleType,
            licensePlate: riders.licensePlate,
            isActive: riders.isActive,
            notes: riders.notes,
            createdAt: riders.createdAt,
            updatedAt: riders.updatedAt,
        })
        .from(riders)
        .innerJoin(appUsers, eq(riders.appUserId, appUsers.id))
        .leftJoin(townships, eq(riders.townshipId, townships.id))
        .where(
            and(
                eq(riders.appUserId, riderId),
                isNull(riders.deletedAt),
                isNull(appUsers.deletedAt),
            ),
        )
        .limit(1);

    if (!row) {
        return null;
    }

    return toRiderDetailDto(row);
}

export async function getRiderById(riderId: string): Promise<RiderDetailDto | null> {
    return findRiderById(riderId);
}

export async function getRiderByIdForViewer(
    viewer: AppAccessViewer,
    riderId: string,
): Promise<RiderDetailDto | null> {
    const riderAccess = getRiderAccess({
        viewer,
        riderAppUserId: riderId,
    });

    if (!riderAccess.canView) {
        return null;
    }

    return findRiderById(riderId);
}

export async function updateRiderProfile(input: {
    riderId: string;
    townshipId: string | null;
    vehicleType: string;
    licensePlate: string | null;
    notes: string | null;
    isActive?: boolean;
}) {
    const nextValues: {
        townshipId: string | null;
        vehicleType: string;
        licensePlate: string | null;
        notes: string | null;
        updatedAt: Date;
        isActive?: boolean;
    } = {
        townshipId: input.townshipId,
        vehicleType: input.vehicleType,
        licensePlate: input.licensePlate,
        notes: input.notes,
        updatedAt: new Date(),
    };

    if (typeof input.isActive === "boolean") {
        nextValues.isActive = input.isActive;
    }

    await db
        .update(riders)
        .set(nextValues)
        .where(and(eq(riders.appUserId, input.riderId), isNull(riders.deletedAt)));
}
