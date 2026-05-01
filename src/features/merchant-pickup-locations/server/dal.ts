import "server-only";
import { and, asc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db, type DbClient } from "@/db";
import { merchantPickupLocations, merchants, townships } from "@/db/schema";
import {
    toMerchantPickupLocationDto,
    type MerchantPickupLocationDto,
} from "@/features/merchant-pickup-locations/server/dto";
import {
    normalizeMerchantPickupLocationLabel,
    toMerchantPickupLocationSearchPattern,
    type MerchantPickupLocationSearchInput,
} from "@/features/merchant-pickup-locations/server/utils";

type MerchantPickupLocationWriteClient = Pick<DbClient, "insert" | "update" | "select" | "delete">;

export async function searchMerchantPickupLocations(
    input: MerchantPickupLocationSearchInput,
): Promise<MerchantPickupLocationDto[]> {
    const searchPattern = toMerchantPickupLocationSearchPattern(input.query);
    const rows = await db
        .select({
            id: merchantPickupLocations.id,
            merchantId: merchantPickupLocations.merchantId,
            label: merchantPickupLocations.label,
            townshipId: merchantPickupLocations.townshipId,
            townshipName: townships.name,
            pickupAddress: merchantPickupLocations.pickupAddress,
            isDefault: merchantPickupLocations.isDefault,
            createdAt: merchantPickupLocations.createdAt,
            updatedAt: merchantPickupLocations.updatedAt,
        })
        .from(merchantPickupLocations)
        .leftJoin(townships, eq(merchantPickupLocations.townshipId, townships.id))
        .where(
            and(
                eq(merchantPickupLocations.merchantId, input.merchantId),
                searchPattern
                    ? or(
                          ilike(merchantPickupLocations.label, searchPattern),
                          ilike(merchantPickupLocations.pickupAddress, searchPattern),
                          ilike(townships.name, searchPattern),
                      )
                    : undefined,
            ),
        )
        .orderBy(
            sql`${merchantPickupLocations.isDefault} desc`,
            asc(merchantPickupLocations.label),
            asc(merchantPickupLocations.createdAt),
        )
        .limit(20);

    return rows.map((row) => toMerchantPickupLocationDto(row));
}

export async function listMerchantPickupLocations(input: {
    merchantId?: string;
    query?: string;
}): Promise<MerchantPickupLocationDto[]> {
    const searchPattern = input.query ? toMerchantPickupLocationSearchPattern(input.query) : null;
    const rows = await db
        .select({
            id: merchantPickupLocations.id,
            merchantId: merchantPickupLocations.merchantId,
            merchantLabel: merchants.shopName,
            label: merchantPickupLocations.label,
            townshipId: merchantPickupLocations.townshipId,
            townshipName: townships.name,
            pickupAddress: merchantPickupLocations.pickupAddress,
            isDefault: merchantPickupLocations.isDefault,
            createdAt: merchantPickupLocations.createdAt,
            updatedAt: merchantPickupLocations.updatedAt,
        })
        .from(merchantPickupLocations)
        .leftJoin(merchants, eq(merchantPickupLocations.merchantId, merchants.appUserId))
        .leftJoin(townships, eq(merchantPickupLocations.townshipId, townships.id))
        .where(
            and(
                input.merchantId
                    ? eq(merchantPickupLocations.merchantId, input.merchantId)
                    : undefined,
                searchPattern
                    ? or(
                          ilike(merchants.shopName, searchPattern),
                          ilike(merchantPickupLocations.label, searchPattern),
                          ilike(merchantPickupLocations.pickupAddress, searchPattern),
                          ilike(townships.name, searchPattern),
                      )
                    : undefined,
            ),
        )
        .orderBy(
            asc(merchants.shopName),
            sql`${merchantPickupLocations.isDefault} desc`,
            asc(merchantPickupLocations.label),
            asc(merchantPickupLocations.createdAt),
        );

    return rows.map((row) => toMerchantPickupLocationDto(row));
}

export async function findMerchantPickupLocationById(input: {
    merchantId: string;
    pickupLocationId: string;
    dbClient?: MerchantPickupLocationWriteClient;
}) {
    const client = input.dbClient ?? db;
    const [row] = await client
        .select({
            id: merchantPickupLocations.id,
            merchantId: merchantPickupLocations.merchantId,
            label: merchantPickupLocations.label,
            townshipId: merchantPickupLocations.townshipId,
            townshipName: townships.name,
            pickupAddress: merchantPickupLocations.pickupAddress,
            isDefault: merchantPickupLocations.isDefault,
            createdAt: merchantPickupLocations.createdAt,
            updatedAt: merchantPickupLocations.updatedAt,
        })
        .from(merchantPickupLocations)
        .leftJoin(townships, eq(merchantPickupLocations.townshipId, townships.id))
        .where(
            and(
                eq(merchantPickupLocations.id, input.pickupLocationId),
                eq(merchantPickupLocations.merchantId, input.merchantId),
            ),
        )
        .limit(1);

    return row ? toMerchantPickupLocationDto(row) : null;
}

export async function findMerchantPickupLocationByLabel(input: {
    merchantId: string;
    label: string;
    excludePickupLocationId?: string;
    dbClient?: MerchantPickupLocationWriteClient;
}) {
    const client = input.dbClient ?? db;
    const normalizedLabel = normalizeMerchantPickupLocationLabel(input.label);
    const [row] = await client
        .select({
            id: merchantPickupLocations.id,
            merchantId: merchantPickupLocations.merchantId,
        })
        .from(merchantPickupLocations)
        .where(
            and(
                eq(merchantPickupLocations.merchantId, input.merchantId),
                eq(merchantPickupLocations.normalizedLabel, normalizedLabel),
                input.excludePickupLocationId
                    ? ne(merchantPickupLocations.id, input.excludePickupLocationId)
                    : undefined,
            ),
        )
        .limit(1);

    return row ?? null;
}

export async function createMerchantPickupLocation(input: {
    merchantId: string;
    label: string;
    townshipId: string;
    pickupAddress: string;
    isDefault: boolean;
    dbClient?: MerchantPickupLocationWriteClient;
}) {
    const client = input.dbClient ?? db;
    const normalizedLabel = normalizeMerchantPickupLocationLabel(input.label);

    if (input.isDefault) {
        await client
            .update(merchantPickupLocations)
            .set({
                isDefault: false,
                updatedAt: new Date(),
            })
            .where(eq(merchantPickupLocations.merchantId, input.merchantId));
    }

    const [created] = await client
        .insert(merchantPickupLocations)
        .values({
            merchantId: input.merchantId,
            label: input.label.trim(),
            normalizedLabel,
            townshipId: input.townshipId,
            pickupAddress: input.pickupAddress,
            isDefault: input.isDefault,
        })
        .returning({ id: merchantPickupLocations.id });

    return created;
}

export async function updateMerchantPickupLocation(input: {
    merchantId: string;
    pickupLocationId: string;
    label: string;
    townshipId: string;
    pickupAddress: string;
    isDefault: boolean;
    dbClient?: MerchantPickupLocationWriteClient;
}) {
    const client = input.dbClient ?? db;
    const normalizedLabel = normalizeMerchantPickupLocationLabel(input.label);

    if (input.isDefault) {
        await client
            .update(merchantPickupLocations)
            .set({
                isDefault: false,
                updatedAt: new Date(),
            })
            .where(eq(merchantPickupLocations.merchantId, input.merchantId));
    }

    await client
        .update(merchantPickupLocations)
        .set({
            label: input.label.trim(),
            normalizedLabel,
            townshipId: input.townshipId,
            pickupAddress: input.pickupAddress,
            isDefault: input.isDefault,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(merchantPickupLocations.id, input.pickupLocationId),
                eq(merchantPickupLocations.merchantId, input.merchantId),
            ),
        );
}

export async function setMerchantPickupLocationDefault(input: {
    merchantId: string;
    pickupLocationId: string;
    dbClient?: MerchantPickupLocationWriteClient;
}) {
    const client = input.dbClient ?? db;

    await client
        .update(merchantPickupLocations)
        .set({
            isDefault: false,
            updatedAt: new Date(),
        })
        .where(eq(merchantPickupLocations.merchantId, input.merchantId));

    await client
        .update(merchantPickupLocations)
        .set({
            isDefault: true,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(merchantPickupLocations.id, input.pickupLocationId),
                eq(merchantPickupLocations.merchantId, input.merchantId),
            ),
        );
}

export async function deleteMerchantPickupLocation(input: {
    merchantId: string;
    pickupLocationId: string;
    dbClient?: MerchantPickupLocationWriteClient;
}) {
    const client = input.dbClient ?? db;

    await client
        .delete(merchantPickupLocations)
        .where(
            and(
                eq(merchantPickupLocations.id, input.pickupLocationId),
                eq(merchantPickupLocations.merchantId, input.merchantId),
            ),
        );
}

export async function bulkDeleteMerchantPickupLocations(input: {
    merchantId: string;
    pickupLocationIds: string[];
    dbClient?: MerchantPickupLocationWriteClient;
}) {
    if (input.pickupLocationIds.length === 0) {
        return;
    }

    const client = input.dbClient ?? db;

    await client
        .delete(merchantPickupLocations)
        .where(
            and(
                eq(merchantPickupLocations.merchantId, input.merchantId),
                inArray(merchantPickupLocations.id, input.pickupLocationIds),
            ),
        );
}

export async function saveMerchantPickupLocationDraft(input: {
    merchantId: string;
    pickupLocationId: string | null;
    label: string;
    townshipId: string;
    pickupAddress: string;
    savePickupLocation: boolean;
    dbClient?: MerchantPickupLocationWriteClient;
}) {
    const client = input.dbClient ?? db;
    const trimmedLabel = input.label.trim();

    if (input.pickupLocationId) {
        const existing = await findMerchantPickupLocationById({
            merchantId: input.merchantId,
            pickupLocationId: input.pickupLocationId,
            dbClient: client,
        });

        if (!existing) {
            return null;
        }

        if (!input.savePickupLocation) {
            return {
                id: existing.id,
                label: trimmedLabel,
                townshipId: input.townshipId,
                pickupAddress: input.pickupAddress,
            };
        }

        const conflict = await findMerchantPickupLocationByLabel({
            merchantId: input.merchantId,
            label: trimmedLabel,
            excludePickupLocationId: existing.id,
            dbClient: client,
        });

        if (conflict) {
            throw new Error("A pickup location with this label already exists for the merchant.");
        }

        await updateMerchantPickupLocation({
            merchantId: input.merchantId,
            pickupLocationId: existing.id,
            label: trimmedLabel,
            townshipId: input.townshipId,
            pickupAddress: input.pickupAddress,
            isDefault: existing.isDefault,
            dbClient: client,
        });

        return {
            id: existing.id,
            label: trimmedLabel,
            townshipId: input.townshipId,
            pickupAddress: input.pickupAddress,
        };
    }

    if (!input.savePickupLocation) {
        return {
            id: null,
            label: trimmedLabel,
            townshipId: input.townshipId,
            pickupAddress: input.pickupAddress,
        };
    }

    const conflict = await findMerchantPickupLocationByLabel({
        merchantId: input.merchantId,
        label: trimmedLabel,
        dbClient: client,
    });

    if (conflict) {
        throw new Error("A pickup location with this label already exists for the merchant.");
    }

    const created = await createMerchantPickupLocation({
        merchantId: input.merchantId,
        label: trimmedLabel,
        townshipId: input.townshipId,
        pickupAddress: input.pickupAddress,
        isDefault: false,
        dbClient: client,
    });

    return {
        id: created.id,
        label: trimmedLabel,
        townshipId: input.townshipId,
        pickupAddress: input.pickupAddress,
    };
}
