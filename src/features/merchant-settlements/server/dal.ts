import "server-only";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
    calculateSettlementItemAmounts,
    signSettlementPaymentSlipKeys,
    toSettlementMoneyString,
} from "./utils";
import { db } from "@/db";
import {
    appUsers,
    bankAccounts,
    merchantSettlementItems,
    merchantSettlements,
    parcelAuditLogs,
    parcelPaymentRecords,
    parcels,
    townships,
} from "@/db/schema";
import { getMerchantSettlementAccess } from "@/features/auth/server/policies/merchant-settlements";

import type { EligibleMerchantSettlementParcelDto, MerchantSettlementHistoryDto } from "./dto";
import type { AppAccessViewer } from "@/features/auth/server/dto";

const editableSettlementStatuses = ["pending", "in_progress"] as const;

function settlementEligibilityWhere(merchantId: string, paymentRecordIds?: string[]) {
    return and(
        eq(parcels.merchantId, merchantId),
        eq(parcels.status, "delivered"),
        eq(parcels.parcelType, "cod"),
        eq(parcelPaymentRecords.codStatus, "collected"),
        eq(parcelPaymentRecords.merchantSettlementStatus, "pending"),
        isNull(parcelPaymentRecords.merchantSettlementId),
        paymentRecordIds?.length ? inArray(parcelPaymentRecords.id, paymentRecordIds) : undefined,
    );
}

function settlementLockWhere(merchantId: string, paymentRecordIds: string[]) {
    return and(
        eq(parcelPaymentRecords.codStatus, "collected"),
        eq(parcelPaymentRecords.merchantSettlementStatus, "pending"),
        isNull(parcelPaymentRecords.merchantSettlementId),
        inArray(parcelPaymentRecords.id, paymentRecordIds),
        sql`exists (
            select 1
            from ${parcels}
            where ${parcels.id} = ${parcelPaymentRecords.parcelId}
                and ${parcels.merchantId} = ${merchantId}
                and ${parcels.status} = ${"delivered"}
                and ${parcels.parcelType} = ${"cod"}
        )`,
    );
}

export async function getEligibleMerchantSettlementParcelsForViewer(
    viewer: AppAccessViewer,
    merchantId: string,
): Promise<EligibleMerchantSettlementParcelDto[]> {
    if (!getMerchantSettlementAccess(viewer).canCreate) {
        return [];
    }

    const rows = await db
        .select({
            parcelId: parcels.id,
            parcelCode: parcels.parcelCode,
            paymentRecordId: parcelPaymentRecords.id,
            recipientName: parcels.recipientName,
            recipientTownshipName: townships.name,
            codAmount: parcels.codAmount,
            deliveryFee: parcels.deliveryFee,
            deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
        })
        .from(parcelPaymentRecords)
        .innerJoin(parcels, eq(parcelPaymentRecords.parcelId, parcels.id))
        .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
        .where(settlementEligibilityWhere(merchantId))
        .orderBy(desc(parcels.createdAt), desc(parcels.id));

    return rows.map((row) => ({
        ...row,
        ...calculateSettlementItemAmounts(row),
    }));
}

export async function getMerchantSettlementHistoryForViewer(
    viewer: AppAccessViewer,
    merchantId: string,
): Promise<MerchantSettlementHistoryDto[]> {
    if (!getMerchantSettlementAccess(viewer).canView) {
        return [];
    }

    const settlementRows = await db
        .select({
            id: merchantSettlements.id,
            referenceNo: merchantSettlements.referenceNo,
            merchantId: merchantSettlements.merchantId,
            totalAmount: merchantSettlements.totalAmount,
            method: merchantSettlements.method,
            snapshotBankName: merchantSettlements.snapshotBankName,
            snapshotBankAccountNumber: merchantSettlements.snapshotBankAccountNumber,
            createdBy: merchantSettlements.createdBy,
            confirmedBy: merchantSettlements.confirmedBy,
            paymentSlipImageKeys: merchantSettlements.paymentSlipImageKeys,
            note: merchantSettlements.note,
            type: merchantSettlements.type,
            status: merchantSettlements.status,
            createdAt: merchantSettlements.createdAt,
            updatedAt: merchantSettlements.updatedAt,
        })
        .from(merchantSettlements)
        .where(eq(merchantSettlements.merchantId, merchantId))
        .orderBy(desc(merchantSettlements.createdAt), desc(merchantSettlements.id));

    if (settlementRows.length === 0) {
        return [];
    }

    const settlementIds = settlementRows.map((settlement) => settlement.id);
    const actorIds = Array.from(
        new Set(
            settlementRows.flatMap((settlement) =>
                [settlement.createdBy, settlement.confirmedBy].filter((value): value is string =>
                    Boolean(value),
                ),
            ),
        ),
    );

    const [itemCountRows, actorRows] = await Promise.all([
        db
            .select({
                settlementId: merchantSettlementItems.merchantSettlementId,
                itemCount: count(merchantSettlementItems.id),
            })
            .from(merchantSettlementItems)
            .where(inArray(merchantSettlementItems.merchantSettlementId, settlementIds))
            .groupBy(merchantSettlementItems.merchantSettlementId),
        actorIds.length
            ? db
                  .select({ id: appUsers.id, fullName: appUsers.fullName })
                  .from(appUsers)
                  .where(inArray(appUsers.id, actorIds))
            : [],
    ]);

    const itemCountBySettlementId = new Map(
        itemCountRows.map((row) => [row.settlementId, row.itemCount]),
    );
    const actorNameById = new Map(actorRows.map((row) => [row.id, row.fullName]));

    return Promise.all(
        settlementRows.map(async (settlement) => ({
            ...settlement,
            itemCount: itemCountBySettlementId.get(settlement.id) ?? 0,
            createdByName: actorNameById.get(settlement.createdBy) ?? settlement.createdBy,
            confirmedByName: settlement.confirmedBy
                ? (actorNameById.get(settlement.confirmedBy) ?? settlement.confirmedBy)
                : null,
            paymentSlipImages: await signSettlementPaymentSlipKeys(settlement.paymentSlipImageKeys),
        })),
    );
}

export async function findConfirmableMerchantSettlement(settlementId: string) {
    const [settlement] = await db
        .select({ id: merchantSettlements.id })
        .from(merchantSettlements)
        .where(
            and(
                eq(merchantSettlements.id, settlementId),
                inArray(merchantSettlements.status, editableSettlementStatuses),
            ),
        )
        .limit(1);

    return settlement ?? null;
}

export async function generateMerchantSettlement(input: {
    merchantId: string;
    bankAccountId: string;
    paymentRecordIds: string[];
    actorAppUserId: string;
}) {
    return db.transaction(async (tx) => {
        const [bankAccount] = await tx
            .select({
                id: bankAccounts.id,
                bankName: bankAccounts.bankName,
                bankAccountNumber: bankAccounts.bankAccountNumber,
            })
            .from(bankAccounts)
            .where(
                and(
                    eq(bankAccounts.id, input.bankAccountId),
                    eq(bankAccounts.appUserId, input.merchantId),
                    eq(bankAccounts.isCompanyAccount, false),
                    isNull(bankAccounts.deletedAt),
                ),
            )
            .limit(1);

        if (!bankAccount) {
            throw new Error("Selected merchant bank account was not found.");
        }

        const eligibleRows = await tx
            .select({
                parcelId: parcels.id,
                parcelCode: parcels.parcelCode,
                paymentRecordId: parcelPaymentRecords.id,
                codAmount: parcels.codAmount,
                deliveryFee: parcels.deliveryFee,
                deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
            })
            .from(parcelPaymentRecords)
            .innerJoin(parcels, eq(parcelPaymentRecords.parcelId, parcels.id))
            .where(settlementEligibilityWhere(input.merchantId, input.paymentRecordIds));

        if (eligibleRows.length !== input.paymentRecordIds.length) {
            throw new Error("Some selected parcels are no longer available for settlement.");
        }

        const items = eligibleRows.map((row) => ({
            parcelId: row.parcelId,
            parcelCode: row.parcelCode,
            paymentRecordId: row.paymentRecordId,
            ...calculateSettlementItemAmounts(row),
        }));
        const totalAmount = toSettlementMoneyString(
            items.reduce((sum, item) => sum + Number(item.netPayableAmount), 0),
        );

        const [settlement] = await tx
            .insert(merchantSettlements)
            .values({
                merchantId: input.merchantId,
                bankAccountId: bankAccount.id,
                totalAmount,
                snapshotBankName: bankAccount.bankName,
                snapshotBankAccountNumber: bankAccount.bankAccountNumber,
                createdBy: input.actorAppUserId,
                status: "pending",
            })
            .returning({ id: merchantSettlements.id });

        const lockedRows = await tx
            .update(parcelPaymentRecords)
            .set({
                merchantSettlementId: settlement.id,
                merchantSettlementStatus: "in_progress",
                updatedAt: new Date(),
            })
            .where(settlementLockWhere(input.merchantId, input.paymentRecordIds))
            .returning({
                id: parcelPaymentRecords.id,
                parcelId: parcelPaymentRecords.parcelId,
            });

        if (lockedRows.length !== input.paymentRecordIds.length) {
            throw new Error("Some selected parcels were locked by another settlement.");
        }

        await tx.insert(merchantSettlementItems).values(
            items.map((item) => ({
                merchantSettlementId: settlement.id,
                parcelPaymentRecordId: item.paymentRecordId,
                snapshotCodAmount: item.snapshotCodAmount,
                snapshotDeliveryFee: item.snapshotDeliveryFee,
                isDeliveryFeeDeducted: item.isDeliveryFeeDeducted,
                netPayableAmount: item.netPayableAmount,
            })),
        );

        await tx.insert(parcelAuditLogs).values(
            lockedRows.map((row) => ({
                parcelId: row.parcelId,
                updatedBy: input.actorAppUserId,
                sourceTable: "parcel_payment_records" as const,
                event: "merchant_settlement.locked",
                oldValues: {
                    merchantSettlementId: null,
                    merchantSettlementStatus: "pending",
                },
                newValues: {
                    merchantSettlementId: settlement.id,
                    merchantSettlementStatus: "in_progress",
                },
            })),
        );

        return { settlementId: settlement.id, merchantId: input.merchantId };
    });
}

export async function confirmMerchantSettlementPayment(input: {
    settlementId: string;
    actorAppUserId: string;
    referenceNo: string;
    paymentSlipImageKey: string;
}) {
    return db.transaction(async (tx) => {
        const [settlement] = await tx
            .update(merchantSettlements)
            .set({
                status: "paid",
                confirmedBy: input.actorAppUserId,
                referenceNo: input.referenceNo,
                paymentSlipImageKeys: [input.paymentSlipImageKey],
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(merchantSettlements.id, input.settlementId),
                    inArray(merchantSettlements.status, editableSettlementStatuses),
                ),
            )
            .returning({
                id: merchantSettlements.id,
                merchantId: merchantSettlements.merchantId,
            });

        if (!settlement) {
            throw new Error("Settlement cannot be confirmed.");
        }

        const settledRows = await tx
            .update(parcelPaymentRecords)
            .set({
                merchantSettlementStatus: "settled",
                updatedAt: new Date(),
            })
            .where(eq(parcelPaymentRecords.merchantSettlementId, input.settlementId))
            .returning({
                parcelId: parcelPaymentRecords.parcelId,
            });

        if (settledRows.length > 0) {
            await tx.insert(parcelAuditLogs).values(
                settledRows.map((row) => ({
                    parcelId: row.parcelId,
                    updatedBy: input.actorAppUserId,
                    sourceTable: "parcel_payment_records" as const,
                    event: "merchant_settlement.paid",
                    oldValues: { merchantSettlementStatus: "in_progress" },
                    newValues: { merchantSettlementStatus: "settled" },
                })),
            );
        }

        return { settlementId: settlement.id, merchantId: settlement.merchantId };
    });
}

export async function cancelOrRejectMerchantSettlement(input: {
    settlementId: string;
    actorAppUserId: string;
    status: "cancelled" | "rejected";
}) {
    return db.transaction(async (tx) => {
        const [settlement] = await tx
            .update(merchantSettlements)
            .set({
                status: input.status,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(merchantSettlements.id, input.settlementId),
                    inArray(merchantSettlements.status, editableSettlementStatuses),
                ),
            )
            .returning({
                id: merchantSettlements.id,
                merchantId: merchantSettlements.merchantId,
            });

        if (!settlement) {
            throw new Error("Settlement cannot be cancelled or rejected.");
        }

        const releasedRows = await tx
            .update(parcelPaymentRecords)
            .set({
                merchantSettlementId: null,
                merchantSettlementStatus: "pending",
                updatedAt: new Date(),
            })
            .where(eq(parcelPaymentRecords.merchantSettlementId, input.settlementId))
            .returning({
                parcelId: parcelPaymentRecords.parcelId,
            });

        if (releasedRows.length > 0) {
            await tx.insert(parcelAuditLogs).values(
                releasedRows.map((row) => ({
                    parcelId: row.parcelId,
                    updatedBy: input.actorAppUserId,
                    sourceTable: "parcel_payment_records" as const,
                    event: `merchant_settlement.${input.status}`,
                    oldValues: {
                        merchantSettlementId: input.settlementId,
                        merchantSettlementStatus: "in_progress",
                    },
                    newValues: {
                        merchantSettlementId: null,
                        merchantSettlementStatus: "pending",
                    },
                })),
            );
        }

        return { settlementId: settlement.id, merchantId: settlement.merchantId };
    });
}
