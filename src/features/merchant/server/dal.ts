import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import {
    toMerchantDetailDto,
    toMerchantListItemDto,
    toMerchantProfileDto,
    type MerchantDetailDto,
    type MerchantListItemDto,
    type MerchantProfileDto,
} from "./dto";
import { isMerchantId, normalizeMerchantSearchQuery, toMerchantSearchPattern } from "./utils";
import { db, type DbClient } from "@/db";
import { appUsers, merchants } from "@/db/schema";
import { getMerchantAccess } from "@/features/auth/server/policies/merchant";

import type { AppAccessViewer } from "@/features/auth/server/dto";

type MerchantWriteClient = Pick<DbClient, "insert">;

async function listMerchants(
    input: {
        query?: string;
        limit?: number;
    } = {},
): Promise<MerchantListItemDto[]> {
    const normalizedQuery = normalizeMerchantSearchQuery(input.query);
    const safeLimit = Number.isInteger(input.limit)
        ? Math.min(Math.max(input.limit ?? 50, 1), 200)
        : 50;
    const searchPattern = normalizedQuery ? toMerchantSearchPattern(normalizedQuery) : null;

    const rows = await db
        .select({
            id: merchants.appUserId,
            shopName: merchants.shopName,
            contactName: appUsers.fullName,
            phoneNumber: appUsers.phoneNumber,
            townshipName: sql<string | null>`null`,
            defaultPickupAddress: sql<string | null>`null`,
            createdAt: merchants.createdAt,
        })
        .from(merchants)
        .innerJoin(appUsers, eq(merchants.appUserId, appUsers.id))
        .where(
            and(
                isNull(merchants.deletedAt),
                isNull(appUsers.deletedAt),
                searchPattern
                    ? or(
                          ilike(merchants.shopName, searchPattern),
                          ilike(appUsers.fullName, searchPattern),
                      )
                    : undefined,
            ),
        )
        .orderBy(asc(merchants.shopName), desc(merchants.createdAt))
        .limit(safeLimit);

    return rows.map((row) => toMerchantListItemDto(row));
}

export async function getMerchantsListForViewer(
    viewer: AppAccessViewer,
    input: {
        query?: string;
        limit?: number;
    } = {},
): Promise<MerchantListItemDto[]> {
    const merchantAccess = getMerchantAccess({ viewer });

    if (!merchantAccess.canViewList) {
        return [];
    }

    return listMerchants(input);
}

async function findMerchantById(merchantId: string): Promise<MerchantDetailDto | null> {
    if (!isMerchantId(merchantId)) {
        return null;
    }

    const [row] = await db
        .select({
            id: merchants.appUserId,
            shopName: merchants.shopName,
            contactName: appUsers.fullName,
            email: appUsers.email,
            phoneNumber: appUsers.phoneNumber,
            pickupTownshipId: sql<string | null>`null`,
            townshipName: sql<string | null>`null`,
            defaultPickupAddress: sql<string | null>`null`,
            notes: merchants.notes,
            createdAt: merchants.createdAt,
            updatedAt: merchants.updatedAt,
        })
        .from(merchants)
        .innerJoin(appUsers, eq(merchants.appUserId, appUsers.id))
        .where(
            and(
                eq(merchants.appUserId, merchantId),
                isNull(merchants.deletedAt),
                isNull(appUsers.deletedAt),
            ),
        )
        .limit(1);

    if (!row) {
        return null;
    }

    return toMerchantDetailDto(row);
}

export async function getMerchantByIdForViewer(
    viewer: AppAccessViewer,
    merchantId: string,
): Promise<MerchantDetailDto | null> {
    const merchantAccess = getMerchantAccess({
        viewer,
        merchantAppUserId: merchantId,
    });

    if (!merchantAccess.canView) {
        return null;
    }

    return findMerchantById(merchantId);
}

async function findMerchantProfileByAppUserId(
    appUserId: string,
): Promise<MerchantProfileDto | null> {
    if (!isMerchantId(appUserId)) {
        return null;
    }

    const [row] = await db
        .select({
            appUserId: merchants.appUserId,
            shopName: merchants.shopName,
            pickupTownshipId: sql<string | null>`null`,
            defaultPickupAddress: sql<string | null>`null`,
            notes: merchants.notes,
            createdAt: merchants.createdAt,
            updatedAt: merchants.updatedAt,
        })
        .from(merchants)
        .where(and(eq(merchants.appUserId, appUserId), isNull(merchants.deletedAt)))
        .limit(1);

    if (!row) {
        return null;
    }

    return toMerchantProfileDto(row);
}

export async function getMerchantProfileByAppUserIdForViewer(
    viewer: AppAccessViewer,
    appUserId: string,
): Promise<MerchantProfileDto | null> {
    const merchantAccess = getMerchantAccess({
        viewer,
        merchantAppUserId: appUserId,
    });

    if (!merchantAccess.canView) {
        return null;
    }

    return findMerchantProfileByAppUserId(appUserId);
}

export async function createMerchantProfile(input: {
    appUserId: string;
    shopName: string;
    notes: string | null;
    dbClient?: MerchantWriteClient;
}) {
    const client = input.dbClient ?? db;
    const [created] = await client
        .insert(merchants)
        .values({
            appUserId: input.appUserId,
            shopName: input.shopName,
            notes: input.notes,
        })
        .returning({ id: merchants.appUserId });

    return created;
}

export async function updateMerchantProfile(input: {
    merchantId: string;
    shopName: string;
    notes: string | null;
}) {
    await db
        .update(merchants)
        .set({
            shopName: input.shopName,
            notes: input.notes,
            updatedAt: new Date(),
        })
        .where(and(eq(merchants.appUserId, input.merchantId), isNull(merchants.deletedAt)));
}

export async function findMerchantProfileLinkByAppUserId(appUserId: string) {
    const [row] = await db
        .select({ appUserId: merchants.appUserId })
        .from(merchants)
        .where(and(eq(merchants.appUserId, appUserId), isNull(merchants.deletedAt)))
        .limit(1);

    if (!row) {
        return null;
    }

    return row;
}
