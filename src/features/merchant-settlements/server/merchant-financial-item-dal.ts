import "server-only";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import {
    deriveMerchantFinancialItemDrafts,
    getLegacyParcelSettlementState,
} from "./merchant-financial-item-utils";
import { db } from "@/db";
import { merchantFinancialItems, parcelPaymentRecords, parcels, townships } from "@/db/schema";

import type {
    BlockedMerchantSettlementCandidateDto,
    MerchantFinancialItemDerivationInput,
    MerchantSettlementCandidateDto,
    MerchantSettlementSelectionDto,
    ReadyMerchantSettlementCandidateDto,
} from "./merchant-financial-item-dto";

type MerchantFinancialItemClient = Pick<typeof db, "insert" | "select" | "update">;

function settlementManagedParcelWhere(parcelId: string) {
    return and(
        eq(merchantFinancialItems.sourceParcelId, parcelId),
        inArray(merchantFinancialItems.lifecycleState, ["locked", "closed"]),
    );
}

function mapCandidateRow(row: {
    id: string;
    merchantId: string;
    sourceParcelId: string | null;
    sourcePaymentRecordId: string | null;
    parcelCode: string | null;
    recipientName: string | null;
    recipientTownshipName: string | null;
    parcelStatus: string | null;
    kind: string;
    direction: string;
    amount: string;
    blockedReasons: string[];
    note: string | null;
    codAmount: string | null;
    deliveryFee: string | null;
    deliveryFeeStatus: string | null;
}): MerchantSettlementCandidateDto {
    return {
        id: row.id,
        merchantId: row.merchantId,
        parcelId: row.sourceParcelId,
        paymentRecordId: row.sourcePaymentRecordId,
        parcelCode: row.parcelCode,
        recipientName: row.recipientName,
        recipientTownshipName: row.recipientTownshipName,
        parcelStatus: row.parcelStatus as MerchantSettlementCandidateDto["parcelStatus"],
        kind: row.kind as MerchantSettlementCandidateDto["kind"],
        direction: row.direction as MerchantSettlementCandidateDto["direction"],
        amount: row.amount,
        codAmount: row.codAmount,
        deliveryFee: row.deliveryFee,
        isDeliveryFeeDeducted:
            row.kind === "cod_remit_credit" && row.deliveryFeeStatus === "deduct_from_settlement",
        blockedReasons: row.blockedReasons,
        note: row.note,
    };
}

async function listMerchantFinancialItemInputs(
    client: MerchantFinancialItemClient,
    filter: SQL,
): Promise<MerchantFinancialItemDerivationInput[]> {
    const rows = await client
        .select({
            merchantId: parcels.merchantId,
            parcelId: parcels.id,
            paymentRecordId: parcelPaymentRecords.id,
            parcelCode: parcels.parcelCode,
            recipientName: parcels.recipientName,
            recipientTownshipName: townships.name,
            parcelType: parcels.parcelType,
            parcelStatus: parcels.status,
            deliveryFeePayer: parcels.deliveryFeePayer,
            deliveryFeePaymentPlan: parcels.deliveryFeePaymentPlan,
            deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
            deliveryFee: parcels.deliveryFee,
            codAmount: parcels.codAmount,
            codStatus: parcelPaymentRecords.codStatus,
            collectionStatus: parcelPaymentRecords.collectionStatus,
            merchantSettlementStatus: parcelPaymentRecords.merchantSettlementStatus,
            merchantSettlementId: parcelPaymentRecords.merchantSettlementId,
            paymentSlipImageKeyCount: parcelPaymentRecords.paymentSlipImageKeys,
        })
        .from(parcels)
        .innerJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
        .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
        .where(filter)
        .orderBy(desc(parcels.createdAt), desc(parcels.id));

    return rows.map((row) => ({
        ...row,
        paymentSlipImageKeyCount: row.paymentSlipImageKeyCount?.length ?? 0,
    }));
}

async function syncDerivedMerchantFinancialItems(
    client: MerchantFinancialItemClient,
    inputs: MerchantFinancialItemDerivationInput[],
) {
    if (inputs.length === 0) {
        return;
    }

    const parcelIds = Array.from(new Set(inputs.map((input) => input.parcelId)));
    const drafts = inputs.flatMap((input) => deriveMerchantFinancialItemDrafts(input));
    const desiredKeys = new Set(drafts.map((draft) => draft.sourceObligationKey));
    const existingItems = await client
        .select({
            id: merchantFinancialItems.id,
            merchantId: merchantFinancialItems.merchantId,
            sourceObligationKey: merchantFinancialItems.sourceObligationKey,
            lifecycleState: merchantFinancialItems.lifecycleState,
            merchantSettlementId: merchantFinancialItems.merchantSettlementId,
            sourceParcelId: merchantFinancialItems.sourceParcelId,
        })
        .from(merchantFinancialItems)
        .where(and(inArray(merchantFinancialItems.sourceParcelId, parcelIds)));
    const existingByKey = new Map(existingItems.map((item) => [item.sourceObligationKey, item]));
    const now = new Date();

    for (const draft of drafts) {
        const existing = existingByKey.get(draft.sourceObligationKey);

        if (!existing) {
            await client.insert(merchantFinancialItems).values({
                merchantId: draft.merchantId,
                sourceObligationKey: draft.sourceObligationKey,
                sourceParcelId: draft.sourceParcelId,
                sourcePaymentRecordId: draft.sourcePaymentRecordId,
                kind: draft.kind,
                direction: draft.direction,
                amount: draft.amount,
                readiness: draft.readiness,
                blockedReasons: draft.blockedReasons,
                lifecycleState: "open",
            });
            continue;
        }

        if (existing.lifecycleState === "locked" || existing.lifecycleState === "closed") {
            continue;
        }

        await client
            .update(merchantFinancialItems)
            .set({
                merchantId: draft.merchantId,
                sourceParcelId: draft.sourceParcelId,
                sourcePaymentRecordId: draft.sourcePaymentRecordId,
                kind: draft.kind,
                direction: draft.direction,
                amount: draft.amount,
                readiness: draft.readiness,
                blockedReasons: draft.blockedReasons,
                lifecycleState: "open",
                merchantSettlementId: null,
                updatedAt: now,
            })
            .where(eq(merchantFinancialItems.id, existing.id));
    }

    for (const existing of existingItems) {
        if (existing.lifecycleState !== "open" || desiredKeys.has(existing.sourceObligationKey)) {
            continue;
        }

        await client
            .update(merchantFinancialItems)
            .set({
                lifecycleState: "void",
                readiness: "blocked",
                blockedReasons: [],
                merchantSettlementId: null,
                updatedAt: now,
            })
            .where(eq(merchantFinancialItems.id, existing.id));
    }

    await syncLegacyParcelSettlementStateForParcelsWithClient(client, parcelIds);
}

export async function syncLegacyParcelSettlementStateForParcelsWithClient(
    client: MerchantFinancialItemClient,
    parcelIds: string[],
) {
    const uniqueParcelIds = Array.from(new Set(parcelIds));

    if (uniqueParcelIds.length === 0) {
        return;
    }

    const financialItemRows = await client
        .select({
            id: merchantFinancialItems.id,
            sourceParcelId: merchantFinancialItems.sourceParcelId,
            lifecycleState: merchantFinancialItems.lifecycleState,
            merchantSettlementId: merchantFinancialItems.merchantSettlementId,
            updatedAt: merchantFinancialItems.updatedAt,
            createdAt: merchantFinancialItems.createdAt,
        })
        .from(merchantFinancialItems)
        .where(
            and(
                inArray(merchantFinancialItems.sourceParcelId, uniqueParcelIds),
                inArray(merchantFinancialItems.lifecycleState, ["open", "locked", "closed"]),
            ),
        )
        .orderBy(
            desc(merchantFinancialItems.updatedAt),
            desc(merchantFinancialItems.createdAt),
            desc(merchantFinancialItems.id),
        );

    const rowsByParcelId = new Map<
        string,
        Array<{
            lifecycleState: "open" | "locked" | "closed" | "void";
            merchantSettlementId: string | null;
        }>
    >();

    for (const parcelId of uniqueParcelIds) {
        rowsByParcelId.set(parcelId, []);
    }

    for (const row of financialItemRows) {
        if (!row.sourceParcelId) {
            continue;
        }

        rowsByParcelId.get(row.sourceParcelId)?.push({
            lifecycleState: row.lifecycleState,
            merchantSettlementId: row.merchantSettlementId,
        });
    }

    const now = new Date();

    for (const parcelId of uniqueParcelIds) {
        const nextState = getLegacyParcelSettlementState(rowsByParcelId.get(parcelId) ?? []);

        await client
            .update(parcelPaymentRecords)
            .set({
                merchantSettlementStatus: nextState.merchantSettlementStatus,
                merchantSettlementId: nextState.merchantSettlementId,
                updatedAt: now,
            })
            .where(eq(parcelPaymentRecords.parcelId, parcelId));
    }
}

export async function reconcileMerchantFinancialItemsForMerchant(merchantId: string) {
    return db.transaction(async (tx) => {
        const inputs = await listMerchantFinancialItemInputs(
            tx,
            eq(parcels.merchantId, merchantId),
        );
        await syncDerivedMerchantFinancialItems(tx, inputs);
    });
}

export async function reconcileMerchantFinancialItemsForParcelWithClient(
    client: MerchantFinancialItemClient,
    parcelId: string,
) {
    const inputs = await listMerchantFinancialItemInputs(client, eq(parcels.id, parcelId));
    await syncDerivedMerchantFinancialItems(client, inputs);
}

export async function reconcileMerchantFinancialItemsForParcel(parcelId: string) {
    return db.transaction(async (tx) => {
        await reconcileMerchantFinancialItemsForParcelWithClient(tx, parcelId);
    });
}

export async function getMerchantSettlementCandidates(
    merchantId: string,
): Promise<MerchantSettlementSelectionDto> {
    await reconcileMerchantFinancialItemsForMerchant(merchantId);

    const rows = await db
        .select({
            id: merchantFinancialItems.id,
            merchantId: merchantFinancialItems.merchantId,
            sourceParcelId: merchantFinancialItems.sourceParcelId,
            sourcePaymentRecordId: merchantFinancialItems.sourcePaymentRecordId,
            parcelCode: parcels.parcelCode,
            recipientName: parcels.recipientName,
            recipientTownshipName: townships.name,
            parcelStatus: parcels.status,
            kind: merchantFinancialItems.kind,
            direction: merchantFinancialItems.direction,
            amount: merchantFinancialItems.amount,
            blockedReasons: merchantFinancialItems.blockedReasons,
            note: merchantFinancialItems.note,
            codAmount: parcels.codAmount,
            deliveryFee: parcels.deliveryFee,
            deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
            readiness: merchantFinancialItems.readiness,
        })
        .from(merchantFinancialItems)
        .leftJoin(parcels, eq(merchantFinancialItems.sourceParcelId, parcels.id))
        .leftJoin(
            parcelPaymentRecords,
            eq(merchantFinancialItems.sourcePaymentRecordId, parcelPaymentRecords.id),
        )
        .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
        .where(
            and(
                eq(merchantFinancialItems.merchantId, merchantId),
                eq(merchantFinancialItems.lifecycleState, "open"),
            ),
        )
        .orderBy(desc(parcels.createdAt), desc(merchantFinancialItems.createdAt));

    const readyCandidates: ReadyMerchantSettlementCandidateDto[] = [];
    const blockedCandidates: BlockedMerchantSettlementCandidateDto[] = [];

    for (const row of rows) {
        const candidate = mapCandidateRow(row);

        if (row.readiness === "ready") {
            readyCandidates.push({ ...candidate, blockedReasons: [] });
        } else {
            blockedCandidates.push(candidate);
        }
    }

    return { readyCandidates, blockedCandidates };
}

export async function getSettlementManagedParcelFinancialState(parcelId: string) {
    const rows = await db
        .select({
            id: merchantFinancialItems.id,
            lifecycleState: merchantFinancialItems.lifecycleState,
        })
        .from(merchantFinancialItems)
        .where(settlementManagedParcelWhere(parcelId))
        .limit(5);

    return {
        hasLockedItems: rows.some((row) => row.lifecycleState === "locked"),
        hasClosedItems: rows.some((row) => row.lifecycleState === "closed"),
    };
}

export async function findSelectableMerchantFinancialItems(input: {
    merchantId: string;
    financialItemIds: string[];
}) {
    return findSelectableMerchantFinancialItemsWithClient(db, input);
}

export async function findSelectableMerchantFinancialItemsWithClient(
    client: MerchantFinancialItemClient,
    input: {
        merchantId: string;
        financialItemIds: string[];
    },
) {
    if (input.financialItemIds.length === 0) {
        return [];
    }

    const rows = await client
        .select({
            id: merchantFinancialItems.id,
            merchantId: merchantFinancialItems.merchantId,
            readiness: merchantFinancialItems.readiness,
            lifecycleState: merchantFinancialItems.lifecycleState,
            direction: merchantFinancialItems.direction,
            amount: merchantFinancialItems.amount,
            kind: merchantFinancialItems.kind,
            note: merchantFinancialItems.note,
            sourceParcelId: merchantFinancialItems.sourceParcelId,
            sourcePaymentRecordId: merchantFinancialItems.sourcePaymentRecordId,
            merchantSettlementId: merchantFinancialItems.merchantSettlementId,
            parcelCode: parcels.parcelCode,
            recipientName: parcels.recipientName,
            recipientTownshipName: townships.name,
            codAmount: parcels.codAmount,
            deliveryFee: parcels.deliveryFee,
            deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
        })
        .from(merchantFinancialItems)
        .leftJoin(parcels, eq(merchantFinancialItems.sourceParcelId, parcels.id))
        .leftJoin(
            parcelPaymentRecords,
            eq(merchantFinancialItems.sourcePaymentRecordId, parcelPaymentRecords.id),
        )
        .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
        .where(
            and(
                eq(merchantFinancialItems.merchantId, input.merchantId),
                inArray(merchantFinancialItems.id, input.financialItemIds),
            ),
        );

    return rows;
}
