import "server-only";
import { and, asc, eq, ilike, inArray, ne, or } from "drizzle-orm";
import {
    toMerchantContactManagementDto,
    toMerchantContactSearchResultDto,
    type MerchantContactManagementDto,
    type MerchantContactSearchResultDto,
} from "./dto";
import {
    normalizeMerchantContactLabel,
    toMerchantContactSearchPattern,
    type MerchantContactSearchInput,
} from "./utils";
import { db, type DbClient } from "@/db";
import { merchantContacts, townships } from "@/db/schema";

type MerchantContactWriteClient = Pick<DbClient, "insert" | "update" | "select" | "delete">;

export async function searchMerchantContacts(
    input: MerchantContactSearchInput,
): Promise<MerchantContactSearchResultDto[]> {
    const searchPattern = toMerchantContactSearchPattern(input.query);
    const rows = await db
        .select({
            id: merchantContacts.id,
            merchantId: merchantContacts.merchantId,
            contactLabel: merchantContacts.contactLabel,
            recipientName: merchantContacts.recipientName,
            recipientPhone: merchantContacts.recipientPhone,
            recipientTownshipId: merchantContacts.recipientTownshipId,
            recipientAddress: merchantContacts.recipientAddress,
        })
        .from(merchantContacts)
        .where(
            and(
                eq(merchantContacts.merchantId, input.merchantId),
                searchPattern ? ilike(merchantContacts.contactLabel, searchPattern) : undefined,
            ),
        )
        .orderBy(asc(merchantContacts.contactLabel), asc(merchantContacts.createdAt))
        .limit(20);

    return rows.map((row) => toMerchantContactSearchResultDto(row));
}

export async function listMerchantContactsForManagement(input: {
    merchantId: string;
    query?: string;
}): Promise<MerchantContactManagementDto[]> {
    const searchPattern = input.query ? toMerchantContactSearchPattern(input.query) : null;
    const rows = await db
        .select({
            id: merchantContacts.id,
            merchantId: merchantContacts.merchantId,
            contactLabel: merchantContacts.contactLabel,
            recipientName: merchantContacts.recipientName,
            recipientPhone: merchantContacts.recipientPhone,
            recipientTownshipId: merchantContacts.recipientTownshipId,
            recipientTownshipName: townships.name,
            recipientAddress: merchantContacts.recipientAddress,
            createdAt: merchantContacts.createdAt,
            updatedAt: merchantContacts.updatedAt,
        })
        .from(merchantContacts)
        .leftJoin(townships, eq(merchantContacts.recipientTownshipId, townships.id))
        .where(
            and(
                eq(merchantContacts.merchantId, input.merchantId),
                searchPattern
                    ? or(
                          ilike(merchantContacts.contactLabel, searchPattern),
                          ilike(merchantContacts.recipientName, searchPattern),
                          ilike(merchantContacts.recipientPhone, searchPattern),
                          ilike(merchantContacts.recipientAddress, searchPattern),
                          ilike(townships.name, searchPattern),
                      )
                    : undefined,
            ),
        )
        .orderBy(asc(merchantContacts.contactLabel), asc(merchantContacts.createdAt));

    return rows.map((row) => toMerchantContactManagementDto(row));
}

export async function findMerchantContactById(input: { merchantId: string; contactId: string }) {
    const [row] = await db
        .select({
            id: merchantContacts.id,
            merchantId: merchantContacts.merchantId,
            contactLabel: merchantContacts.contactLabel,
            normalizedContactLabel: merchantContacts.normalizedContactLabel,
        })
        .from(merchantContacts)
        .where(
            and(
                eq(merchantContacts.id, input.contactId),
                eq(merchantContacts.merchantId, input.merchantId),
            ),
        )
        .limit(1);

    return row ?? null;
}

export async function getMerchantContactManagementById(input: {
    merchantId: string;
    contactId: string;
}) {
    const [row] = await db
        .select({
            id: merchantContacts.id,
            merchantId: merchantContacts.merchantId,
            contactLabel: merchantContacts.contactLabel,
            recipientName: merchantContacts.recipientName,
            recipientPhone: merchantContacts.recipientPhone,
            recipientTownshipId: merchantContacts.recipientTownshipId,
            recipientTownshipName: townships.name,
            recipientAddress: merchantContacts.recipientAddress,
            createdAt: merchantContacts.createdAt,
            updatedAt: merchantContacts.updatedAt,
        })
        .from(merchantContacts)
        .leftJoin(townships, eq(merchantContacts.recipientTownshipId, townships.id))
        .where(
            and(
                eq(merchantContacts.id, input.contactId),
                eq(merchantContacts.merchantId, input.merchantId),
            ),
        )
        .limit(1);

    return row ? toMerchantContactManagementDto(row) : null;
}

export async function findMerchantContactByLabel(input: {
    merchantId: string;
    contactLabel: string;
    excludeContactId?: string;
    dbClient?: MerchantContactWriteClient;
}) {
    const client = input.dbClient ?? db;
    const normalizedContactLabel = normalizeMerchantContactLabel(input.contactLabel);
    const [row] = await client
        .select({
            id: merchantContacts.id,
            merchantId: merchantContacts.merchantId,
            normalizedContactLabel: merchantContacts.normalizedContactLabel,
        })
        .from(merchantContacts)
        .where(
            and(
                eq(merchantContacts.merchantId, input.merchantId),
                eq(merchantContacts.normalizedContactLabel, normalizedContactLabel),
                input.excludeContactId
                    ? ne(merchantContacts.id, input.excludeContactId)
                    : undefined,
            ),
        )
        .limit(1);

    return row ?? null;
}

export async function createMerchantContact(input: {
    merchantId: string;
    contactLabel: string;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
    dbClient?: MerchantContactWriteClient;
}) {
    const client = input.dbClient ?? db;
    const normalizedContactLabel = normalizeMerchantContactLabel(input.contactLabel);
    const [created] = await client
        .insert(merchantContacts)
        .values({
            merchantId: input.merchantId,
            contactLabel: input.contactLabel.trim(),
            normalizedContactLabel,
            recipientName: input.recipientName,
            recipientPhone: input.recipientPhone,
            recipientTownshipId: input.recipientTownshipId,
            recipientAddress: input.recipientAddress,
        })
        .returning({ id: merchantContacts.id });

    return created;
}

export async function updateMerchantContact(input: {
    merchantId: string;
    contactId: string;
    contactLabel: string;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
    dbClient?: MerchantContactWriteClient;
}) {
    const client = input.dbClient ?? db;
    const normalizedContactLabel = normalizeMerchantContactLabel(input.contactLabel);

    await client
        .update(merchantContacts)
        .set({
            contactLabel: input.contactLabel.trim(),
            normalizedContactLabel,
            recipientName: input.recipientName,
            recipientPhone: input.recipientPhone,
            recipientTownshipId: input.recipientTownshipId,
            recipientAddress: input.recipientAddress,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(merchantContacts.id, input.contactId),
                eq(merchantContacts.merchantId, input.merchantId),
            ),
        );
}

export async function deleteMerchantContact(input: {
    merchantId: string;
    contactId: string;
    dbClient?: MerchantContactWriteClient;
}) {
    const client = input.dbClient ?? db;

    await client
        .delete(merchantContacts)
        .where(
            and(
                eq(merchantContacts.id, input.contactId),
                eq(merchantContacts.merchantId, input.merchantId),
            ),
        );
}

export async function bulkDeleteMerchantContacts(input: {
    merchantId: string;
    contactIds: string[];
    dbClient?: MerchantContactWriteClient;
}) {
    if (input.contactIds.length === 0) {
        return;
    }

    const client = input.dbClient ?? db;

    await client
        .delete(merchantContacts)
        .where(
            and(
                eq(merchantContacts.merchantId, input.merchantId),
                inArray(merchantContacts.id, input.contactIds),
            ),
        );
}

export async function upsertMerchantContact(input: {
    merchantId: string;
    contactLabel: string;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
    dbClient?: MerchantContactWriteClient;
}) {
    const client = input.dbClient ?? db;
    const normalizedContactLabel = normalizeMerchantContactLabel(input.contactLabel);
    const existing = await findMerchantContactByLabel({
        merchantId: input.merchantId,
        contactLabel: input.contactLabel,
        dbClient: client,
    });

    if (existing) {
        await client
            .update(merchantContacts)
            .set({
                contactLabel: input.contactLabel.trim(),
                normalizedContactLabel,
                recipientName: input.recipientName,
                recipientPhone: input.recipientPhone,
                recipientTownshipId: input.recipientTownshipId,
                recipientAddress: input.recipientAddress,
                updatedAt: new Date(),
            })
            .where(eq(merchantContacts.id, existing.id));

        return {
            contactId: existing.id,
            action: "updated" as const,
        };
    }

    const [created] = await client
        .insert(merchantContacts)
        .values({
            merchantId: input.merchantId,
            contactLabel: input.contactLabel.trim(),
            normalizedContactLabel,
            recipientName: input.recipientName,
            recipientPhone: input.recipientPhone,
            recipientTownshipId: input.recipientTownshipId,
            recipientAddress: input.recipientAddress,
        })
        .returning({ id: merchantContacts.id });

    return {
        contactId: created.id,
        action: "created" as const,
    };
}
