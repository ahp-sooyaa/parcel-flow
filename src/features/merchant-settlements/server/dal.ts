import "server-only";
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import {
    calculateSettlementItemAmounts,
    calculateSettlementTotals,
    isMerchantSettlementId,
    signSettlementPaymentSlipKeys,
    toSettlementMoneyString,
} from "./utils";
import { db } from "@/db";
import {
    appUsers,
    bankAccounts,
    merchants,
    merchantSettlementItems,
    merchantSettlements,
    parcelAuditLogs,
    parcelPaymentRecords,
    parcels,
    townships,
} from "@/db/schema";
import { getMerchantSettlementAccess } from "@/features/auth/server/policies/merchant-settlements";

import type {
    EligibleMerchantSettlementParcelDto,
    MerchantSettlementDetailDto,
    MerchantSettlementHistoryDto,
    MerchantSettlementItemDto,
    MerchantSettlementListItemDto,
    MerchantSettlementListQuery,
    MerchantSettlementTotalsDto,
    PaginatedMerchantSettlementListDto,
} from "./dto";
import type { AppAccessViewer } from "@/features/auth/server/dto";

const editableSettlementStatuses = ["pending", "in_progress"] as const;

type SettlementSummary = MerchantSettlementTotalsDto & {
    itemCount: number;
};
type SettlementListBaseRow = Omit<
    MerchantSettlementListItemDto,
    "createdByName" | "confirmedByName" | "itemCount"
>;

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

function toSettlementSearchPattern(query: string) {
    const trimmed = query.trim();

    return trimmed ? `%${trimmed.replaceAll("%", "").replaceAll("_", "")}%` : "";
}

function settlementListWhere(input: MerchantSettlementListQuery) {
    const searchPattern = toSettlementSearchPattern(input.query);

    return and(
        input.status ? eq(merchantSettlements.status, input.status) : undefined,
        searchPattern
            ? or(
                  sql`cast(${merchantSettlements.id} as text) ilike ${searchPattern}`,
                  ilike(merchantSettlements.referenceNo, searchPattern),
                  ilike(merchants.shopName, searchPattern),
              )
            : undefined,
    );
}

async function getSettlementSummaries(settlementIds: string[]) {
    if (settlementIds.length === 0) {
        return new Map<string, SettlementSummary>();
    }

    const rows = await db
        .select({
            settlementId: merchantSettlementItems.merchantSettlementId,
            itemCount: count(merchantSettlementItems.id),
            codSubtotal: sql<string>`
                coalesce(sum(${merchantSettlementItems.snapshotCodAmount}), 0)::numeric(12, 2)::text
            `,
            deliveryFeeDeductedTotal: sql<string>`
                coalesce(
                    sum(
                        case
                            when ${merchantSettlementItems.isDeliveryFeeDeducted}
                            then ${merchantSettlementItems.snapshotDeliveryFee}
                            else 0
                        end
                    ),
                    0
                )::numeric(12, 2)::text
            `,
            netPayableTotal: sql<string>`
                coalesce(sum(${merchantSettlementItems.netPayableAmount}), 0)::numeric(12, 2)::text
            `,
        })
        .from(merchantSettlementItems)
        .where(inArray(merchantSettlementItems.merchantSettlementId, settlementIds))
        .groupBy(merchantSettlementItems.merchantSettlementId);

    return new Map(
        rows.map((row) => [
            row.settlementId,
            {
                itemCount: row.itemCount,
                codSubtotal: row.codSubtotal,
                deliveryFeeDeductedTotal: row.deliveryFeeDeductedTotal,
                netPayableTotal: row.netPayableTotal,
            },
        ]),
    );
}

async function getActorNameById(actorIds: string[]) {
    const uniqueActorIds = Array.from(new Set(actorIds));

    if (uniqueActorIds.length === 0) {
        return new Map<string, string>();
    }

    const actorRows = await db
        .select({ id: appUsers.id, fullName: appUsers.fullName })
        .from(appUsers)
        .where(inArray(appUsers.id, uniqueActorIds));

    return new Map(actorRows.map((row) => [row.id, row.fullName]));
}

async function shapeSettlementListRows<TSettlement extends SettlementListBaseRow>(
    settlementRows: TSettlement[],
): Promise<
    (TSettlement &
        Pick<MerchantSettlementListItemDto, "createdByName" | "confirmedByName" | "itemCount">)[]
> {
    const settlementIds = settlementRows.map((settlement) => settlement.id);
    const actorNameById = await getActorNameById(
        settlementRows.flatMap((settlement) =>
            [settlement.createdBy, settlement.confirmedBy].filter((value): value is string =>
                Boolean(value),
            ),
        ),
    );
    const summariesBySettlementId = await getSettlementSummaries(settlementIds);

    return settlementRows.map((settlement) => {
        const summary = summariesBySettlementId.get(settlement.id);

        return {
            ...settlement,
            totalAmount: summary?.netPayableTotal ?? settlement.totalAmount,
            itemCount: summary?.itemCount ?? 0,
            createdByName: actorNameById.get(settlement.createdBy) ?? settlement.createdBy,
            confirmedByName: settlement.confirmedBy
                ? (actorNameById.get(settlement.confirmedBy) ?? settlement.confirmedBy)
                : null,
        };
    });
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
            merchantLabel: merchants.shopName,
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
        .innerJoin(merchants, eq(merchantSettlements.merchantId, merchants.appUserId))
        .where(eq(merchantSettlements.merchantId, merchantId))
        .orderBy(desc(merchantSettlements.createdAt), desc(merchantSettlements.id));

    if (settlementRows.length === 0) {
        return [];
    }

    const shapedRows = await shapeSettlementListRows(settlementRows);

    return Promise.all(
        shapedRows.map(async (settlement) => ({
            ...settlement,
            paymentSlipImages: await signSettlementPaymentSlipKeys(settlement.paymentSlipImageKeys),
        })),
    );
}

export async function getMerchantSettlementsListForViewer(
    viewer: AppAccessViewer,
    input: MerchantSettlementListQuery,
): Promise<PaginatedMerchantSettlementListDto> {
    if (!getMerchantSettlementAccess(viewer).canView) {
        return {
            items: [],
            page: 1,
            pageSize: input.pageSize,
            totalItems: 0,
            totalPages: 1,
        };
    }

    const filters = settlementListWhere(input);
    const [totalRow] = await db
        .select({ totalItems: count(merchantSettlements.id) })
        .from(merchantSettlements)
        .innerJoin(merchants, eq(merchantSettlements.merchantId, merchants.appUserId))
        .where(filters);
    const totalItems = totalRow?.totalItems ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / input.pageSize));
    const page = Math.min(input.page, totalPages);
    const offset = (page - 1) * input.pageSize;
    const settlementRows =
        totalItems === 0
            ? []
            : await db
                  .select({
                      id: merchantSettlements.id,
                      referenceNo: merchantSettlements.referenceNo,
                      merchantId: merchantSettlements.merchantId,
                      merchantLabel: merchants.shopName,
                      totalAmount: merchantSettlements.totalAmount,
                      method: merchantSettlements.method,
                      snapshotBankName: merchantSettlements.snapshotBankName,
                      snapshotBankAccountNumber: merchantSettlements.snapshotBankAccountNumber,
                      createdBy: merchantSettlements.createdBy,
                      confirmedBy: merchantSettlements.confirmedBy,
                      note: merchantSettlements.note,
                      type: merchantSettlements.type,
                      status: merchantSettlements.status,
                      createdAt: merchantSettlements.createdAt,
                      updatedAt: merchantSettlements.updatedAt,
                  })
                  .from(merchantSettlements)
                  .innerJoin(merchants, eq(merchantSettlements.merchantId, merchants.appUserId))
                  .where(filters)
                  .orderBy(desc(merchantSettlements.createdAt), desc(merchantSettlements.id))
                  .limit(input.pageSize)
                  .offset(offset);

    return {
        items: await shapeSettlementListRows(settlementRows),
        page,
        pageSize: input.pageSize,
        totalItems,
        totalPages,
    };
}

export async function getMerchantSettlementDetailForViewer(
    viewer: AppAccessViewer,
    settlementId: string,
    input: { signPaymentSlips?: boolean } = {},
): Promise<MerchantSettlementDetailDto | null> {
    if (!getMerchantSettlementAccess(viewer).canView) {
        return null;
    }

    if (!isMerchantSettlementId(settlementId)) {
        return null;
    }

    const [settlementRow] = await db
        .select({
            id: merchantSettlements.id,
            referenceNo: merchantSettlements.referenceNo,
            merchantId: merchantSettlements.merchantId,
            merchantLabel: merchants.shopName,
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
        .innerJoin(merchants, eq(merchantSettlements.merchantId, merchants.appUserId))
        .where(eq(merchantSettlements.id, settlementId))
        .limit(1);

    if (!settlementRow) {
        return null;
    }

    const itemRows = await db
        .select({
            id: merchantSettlementItems.id,
            parcelId: parcels.id,
            parcelCode: parcels.parcelCode,
            recipientName: parcels.recipientName,
            recipientTownshipName: townships.name,
            snapshotCodAmount: merchantSettlementItems.snapshotCodAmount,
            snapshotDeliveryFee: merchantSettlementItems.snapshotDeliveryFee,
            isDeliveryFeeDeducted: merchantSettlementItems.isDeliveryFeeDeducted,
            netPayableAmount: merchantSettlementItems.netPayableAmount,
            createdAt: merchantSettlementItems.createdAt,
        })
        .from(merchantSettlementItems)
        .innerJoin(
            parcelPaymentRecords,
            eq(merchantSettlementItems.parcelPaymentRecordId, parcelPaymentRecords.id),
        )
        .innerJoin(parcels, eq(parcelPaymentRecords.parcelId, parcels.id))
        .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
        .where(eq(merchantSettlementItems.merchantSettlementId, settlementId))
        .orderBy(desc(merchantSettlementItems.createdAt), desc(merchantSettlementItems.id));

    const items: MerchantSettlementItemDto[] = itemRows;
    const actorNameById = await getActorNameById(
        [settlementRow.createdBy, settlementRow.confirmedBy].filter((value): value is string =>
            Boolean(value),
        ),
    );
    const shapedRows = await shapeSettlementListRows([settlementRow]);
    const [shapedSettlement] = shapedRows;
    const paymentSlipImageKeys = settlementRow.paymentSlipImageKeys ?? [];
    const paymentSlipImages =
        input.signPaymentSlips === false
            ? []
            : await signSettlementPaymentSlipKeys(paymentSlipImageKeys);

    return {
        ...shapedSettlement,
        paymentSlipImages,
        paymentSlipImageCount: paymentSlipImageKeys.length,
        createdByActor: {
            id: settlementRow.createdBy,
            name: actorNameById.get(settlementRow.createdBy) ?? settlementRow.createdBy,
        },
        confirmedByActor: settlementRow.confirmedBy
            ? {
                  id: settlementRow.confirmedBy,
                  name: actorNameById.get(settlementRow.confirmedBy) ?? settlementRow.confirmedBy,
              }
            : null,
        totals: calculateSettlementTotals(items),
        items,
    };
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
