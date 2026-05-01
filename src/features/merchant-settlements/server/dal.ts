import "server-only";
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import {
    findSelectableMerchantFinancialItemsWithClient,
    getMerchantSettlementCandidates,
    reconcileMerchantFinancialItemsForParcelWithClient,
    syncLegacyParcelSettlementStateForParcelsWithClient,
} from "./merchant-financial-item-dal";
import {
    calculateSettlementItemAmounts,
    calculateSettlementTotals,
    getSettlementStatusAfterGeneration,
    isMerchantSettlementId,
    signSettlementPaymentSlipKeys,
    toSettlementMoneyString,
    validateSettlementSelectionRows,
} from "./utils";
import { db } from "@/db";
import {
    appUsers,
    bankAccounts,
    merchants,
    merchantFinancialItems,
    merchantSettlementItems,
    merchantSettlements,
    parcelAuditLogs,
    parcels,
    townships,
} from "@/db/schema";
import { getMerchantSettlementAccess } from "@/features/auth/server/policies/merchant-settlements";

import type {
    MerchantFinancialDirection,
    MerchantFinancialItemKind,
    MerchantSettlementDetailDto,
    MerchantSettlementHistoryDto,
    MerchantSettlementItemDto,
    MerchantSettlementListItemDto,
    MerchantSettlementListQuery,
    MerchantSettlementSelectionDto,
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

function toSettlementSearchPattern(query: string) {
    const trimmed = query.trim();

    return trimmed ? `%${trimmed.replaceAll("%", "").replaceAll("_", "")}%` : "";
}

function settlementListWhere(input: MerchantSettlementListQuery) {
    const searchPattern = toSettlementSearchPattern(input.query);

    return and(
        input.status.length > 0 ? inArray(merchantSettlements.status, input.status) : undefined,
        searchPattern
            ? or(
                  sql`cast(${merchantSettlements.id} as text) ilike ${searchPattern}`,
                  ilike(merchantSettlements.referenceNo, searchPattern),
                  ilike(merchants.shopName, searchPattern),
              )
            : undefined,
    );
}

function absoluteSettlementAmountSql() {
    return sql<string>`abs(${merchantSettlementItems.netPayableAmount})`;
}

async function getSettlementSummaries(settlementIds: string[]) {
    if (settlementIds.length === 0) {
        return new Map<string, SettlementSummary>();
    }

    const amountSql = absoluteSettlementAmountSql();
    const rows = await db
        .select({
            settlementId: merchantSettlementItems.merchantSettlementId,
            itemCount: count(merchantSettlementItems.id),
            creditsTotal: sql<string>`
                coalesce(
                    sum(
                        case
                            when ${merchantSettlementItems.direction} = 'company_owes_merchant'
                            then ${amountSql}
                            else 0
                        end
                    ),
                    0
                )::numeric(12, 2)::text
            `,
            debitsTotal: sql<string>`
                coalesce(
                    sum(
                        case
                            when ${merchantSettlementItems.direction} = 'merchant_owes_company'
                            then ${amountSql}
                            else 0
                        end
                    ),
                    0
                )::numeric(12, 2)::text
            `,
            netTotal: sql<string>`
                coalesce(
                    sum(
                        case
                            when ${merchantSettlementItems.direction} = 'company_owes_merchant'
                            then ${amountSql}
                            else ${amountSql} * -1
                        end
                    ),
                    0
                )::numeric(12, 2)::text
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
                creditsTotal: row.creditsTotal,
                debitsTotal: row.debitsTotal,
                netTotal: row.netTotal,
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
        Pick<
            MerchantSettlementListItemDto,
            "createdByName" | "confirmedByName" | "itemCount" | "creditsTotal" | "debitsTotal"
        >)[]
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
            totalAmount: summary?.netTotal ?? settlement.totalAmount,
            creditsTotal: summary?.creditsTotal ?? settlement.creditsTotal,
            debitsTotal: summary?.debitsTotal ?? settlement.debitsTotal,
            itemCount: summary?.itemCount ?? 0,
            createdByName: actorNameById.get(settlement.createdBy) ?? settlement.createdBy,
            confirmedByName: settlement.confirmedBy
                ? (actorNameById.get(settlement.confirmedBy) ?? settlement.confirmedBy)
                : null,
        };
    });
}

function getSettlementNetAmount(input: { amount: string; direction: MerchantFinancialDirection }) {
    const amount = Number(input.amount);

    return toSettlementMoneyString(
        input.direction === "company_owes_merchant" ? amount : amount * -1,
    );
}

function buildSettlementItemSnapshot(input: {
    merchantFinancialItemId: string;
    sourceParcelId: string | null;
    sourcePaymentRecordId: string | null;
    kind: MerchantFinancialItemKind;
    direction: MerchantFinancialDirection;
    amount: string;
    codAmount: string | null;
    deliveryFee: string | null;
    deliveryFeeStatus: string | null;
}) {
    if (input.kind === "cod_remit_credit") {
        const amounts = calculateSettlementItemAmounts({
            codAmount: input.codAmount ?? "0",
            deliveryFee: input.deliveryFee ?? "0",
            deliveryFeeStatus: (input.deliveryFeeStatus ?? "unpaid") as
                | "unpaid"
                | "paid_by_merchant"
                | "collected_from_receiver"
                | "deduct_from_settlement"
                | "bill_merchant"
                | "waived",
        });

        return {
            merchantFinancialItemId: input.merchantFinancialItemId,
            parcelId: input.sourceParcelId,
            parcelPaymentRecordId: input.sourcePaymentRecordId,
            candidateKind: input.kind,
            direction: input.direction,
            snapshotAmount: input.amount,
            snapshotCodAmount: amounts.snapshotCodAmount,
            snapshotDeliveryFee: amounts.snapshotDeliveryFee,
            isDeliveryFeeDeducted: amounts.isDeliveryFeeDeducted,
            netPayableAmount: amounts.netPayableAmount,
        };
    }

    const deliveryFee = input.deliveryFee ?? input.amount;
    const netPayableAmount = getSettlementNetAmount({
        amount: input.amount,
        direction: input.direction,
    });

    return {
        merchantFinancialItemId: input.merchantFinancialItemId,
        parcelId: input.sourceParcelId,
        parcelPaymentRecordId: input.sourcePaymentRecordId,
        candidateKind: input.kind,
        direction: input.direction,
        snapshotAmount: input.amount,
        snapshotCodAmount: "0.00",
        snapshotDeliveryFee: deliveryFee,
        isDeliveryFeeDeducted: false,
        netPayableAmount,
    };
}

async function findSettlementBankAccount(
    client: Pick<typeof db, "select">,
    input: {
        bankAccountId: string | null;
        merchantId: string;
        direction: "remit" | "invoice" | "balanced";
    },
) {
    if (input.direction === "balanced") {
        return null;
    }

    if (!input.bankAccountId) {
        throw new Error("A bank account is required for this settlement.");
    }

    const [bankAccount] = await client
        .select({
            id: bankAccounts.id,
            bankName: bankAccounts.bankName,
            bankAccountNumber: bankAccounts.bankAccountNumber,
        })
        .from(bankAccounts)
        .where(
            and(
                eq(bankAccounts.id, input.bankAccountId),
                isNull(bankAccounts.deletedAt),
                input.direction === "remit"
                    ? and(
                          eq(bankAccounts.appUserId, input.merchantId),
                          eq(bankAccounts.isCompanyAccount, false),
                      )
                    : and(eq(bankAccounts.isCompanyAccount, true), isNull(bankAccounts.appUserId)),
            ),
        )
        .limit(1);

    if (!bankAccount) {
        throw new Error("Selected bank account was not found for this settlement direction.");
    }

    return bankAccount;
}

export async function getMerchantSettlementSelectionForViewer(
    viewer: AppAccessViewer,
    merchantId: string,
): Promise<MerchantSettlementSelectionDto> {
    if (!getMerchantSettlementAccess(viewer).canCreate) {
        return { readyCandidates: [], blockedCandidates: [] };
    }

    return getMerchantSettlementCandidates(merchantId);
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
            creditsTotal: merchantSettlements.creditsTotal,
            debitsTotal: merchantSettlements.debitsTotal,
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
                      creditsTotal: merchantSettlements.creditsTotal,
                      debitsTotal: merchantSettlements.debitsTotal,
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
            creditsTotal: merchantSettlements.creditsTotal,
            debitsTotal: merchantSettlements.debitsTotal,
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
            merchantFinancialItemId: merchantSettlementItems.merchantFinancialItemId,
            parcelId: merchantSettlementItems.parcelId,
            parcelCode: parcels.parcelCode,
            recipientName: parcels.recipientName,
            recipientTownshipName: townships.name,
            candidateKind: merchantSettlementItems.candidateKind,
            direction: merchantSettlementItems.direction,
            snapshotAmount: merchantSettlementItems.snapshotAmount,
            snapshotCodAmount: merchantSettlementItems.snapshotCodAmount,
            snapshotDeliveryFee: merchantSettlementItems.snapshotDeliveryFee,
            isDeliveryFeeDeducted: merchantSettlementItems.isDeliveryFeeDeducted,
            netPayableAmount: merchantSettlementItems.netPayableAmount,
            createdAt: merchantSettlementItems.createdAt,
        })
        .from(merchantSettlementItems)
        .leftJoin(parcels, eq(merchantSettlementItems.parcelId, parcels.id))
        .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
        .where(eq(merchantSettlementItems.merchantSettlementId, settlementId))
        .orderBy(desc(merchantSettlementItems.createdAt), desc(merchantSettlementItems.id));

    const items: MerchantSettlementItemDto[] = itemRows;
    const actorNameById = await getActorNameById(
        [settlementRow.createdBy, settlementRow.confirmedBy].filter((value): value is string =>
            Boolean(value),
        ),
    );
    const [shapedSettlement] = await shapeSettlementListRows([settlementRow]);
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
        .select({
            id: merchantSettlements.id,
            type: merchantSettlements.type,
            status: merchantSettlements.status,
        })
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

export async function isMerchantSettlementReferenceNoInUse(input: {
    referenceNo: string;
    excludeSettlementId?: string;
}) {
    const [existing] = await db
        .select({ id: merchantSettlements.id })
        .from(merchantSettlements)
        .where(
            and(
                eq(merchantSettlements.referenceNo, input.referenceNo),
                input.excludeSettlementId
                    ? sql`${merchantSettlements.id} <> ${input.excludeSettlementId}`
                    : undefined,
            ),
        )
        .limit(1);

    return Boolean(existing);
}

export async function generateMerchantSettlement(input: {
    merchantId: string;
    bankAccountId: string | null;
    financialItemIds: string[];
    actorAppUserId: string;
}) {
    return db.transaction(async (tx) => {
        const candidateRows = await findSelectableMerchantFinancialItemsWithClient(tx, {
            merchantId: input.merchantId,
            financialItemIds: input.financialItemIds,
        });
        const selectionGuard = validateSettlementSelectionRows({
            expectedMerchantId: input.merchantId,
            selectedIds: input.financialItemIds,
            selectedRows: candidateRows.map((row) => ({
                id: row.id,
                merchantId: row.merchantId,
                readiness: row.readiness,
                lifecycleState: row.lifecycleState,
            })),
        });

        if (!selectionGuard.ok) {
            throw new Error(selectionGuard.message);
        }

        const creditsTotal = candidateRows.reduce(
            (sum, row) =>
                sum + (row.direction === "company_owes_merchant" ? Number(row.amount) : 0),
            0,
        );
        const debitsTotal = candidateRows.reduce(
            (sum, row) =>
                sum + (row.direction === "merchant_owes_company" ? Number(row.amount) : 0),
            0,
        );
        const netTotal = creditsTotal - debitsTotal;
        const direction = netTotal > 0 ? "remit" : netTotal < 0 ? "invoice" : ("balanced" as const);
        const settlementStatus = getSettlementStatusAfterGeneration(direction);
        const bankAccount = await findSettlementBankAccount(tx, {
            bankAccountId: input.bankAccountId,
            merchantId: input.merchantId,
            direction,
        });
        const [settlement] = await tx
            .insert(merchantSettlements)
            .values({
                merchantId: input.merchantId,
                bankAccountId: bankAccount?.id ?? null,
                creditsTotal: toSettlementMoneyString(creditsTotal),
                debitsTotal: toSettlementMoneyString(debitsTotal),
                totalAmount: toSettlementMoneyString(netTotal),
                snapshotBankName: bankAccount?.bankName ?? null,
                snapshotBankAccountNumber: bankAccount?.bankAccountNumber ?? null,
                createdBy: input.actorAppUserId,
                confirmedBy: settlementStatus === "paid" ? input.actorAppUserId : null,
                type: direction,
                status: settlementStatus,
            })
            .returning({
                id: merchantSettlements.id,
                merchantId: merchantSettlements.merchantId,
                status: merchantSettlements.status,
            });

        const nextLifecycleState = settlement.status === "paid" ? "closed" : "locked";
        const lockedRows = await tx
            .update(merchantFinancialItems)
            .set({
                merchantSettlementId: settlement.id,
                lifecycleState: nextLifecycleState,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(merchantFinancialItems.merchantId, input.merchantId),
                    inArray(merchantFinancialItems.id, input.financialItemIds),
                    eq(merchantFinancialItems.lifecycleState, "open"),
                    eq(merchantFinancialItems.readiness, "ready"),
                    isNull(merchantFinancialItems.merchantSettlementId),
                ),
            )
            .returning({
                id: merchantFinancialItems.id,
                sourceParcelId: merchantFinancialItems.sourceParcelId,
                sourcePaymentRecordId: merchantFinancialItems.sourcePaymentRecordId,
            });

        if (lockedRows.length !== input.financialItemIds.length) {
            throw new Error(
                "Some selected settlement candidates were locked by another settlement.",
            );
        }

        await tx.insert(merchantSettlementItems).values(
            candidateRows.map((row) => ({
                merchantSettlementId: settlement.id,
                ...buildSettlementItemSnapshot({
                    merchantFinancialItemId: row.id,
                    sourceParcelId: row.sourceParcelId,
                    sourcePaymentRecordId: row.sourcePaymentRecordId,
                    kind: row.kind,
                    direction: row.direction,
                    amount: row.amount,
                    codAmount: row.codAmount,
                    deliveryFee: row.deliveryFee,
                    deliveryFeeStatus: row.deliveryFeeStatus,
                }),
            })),
        );

        const affectedParcelIds = Array.from(
            new Set(
                lockedRows
                    .map((row) => row.sourceParcelId)
                    .filter((value): value is string => Boolean(value)),
            ),
        );

        await syncLegacyParcelSettlementStateForParcelsWithClient(tx, affectedParcelIds);

        if (affectedParcelIds.length > 0) {
            await tx.insert(parcelAuditLogs).values(
                affectedParcelIds.map((parcelId) => ({
                    parcelId,
                    updatedBy: input.actorAppUserId,
                    sourceTable: "parcel_payment_records" as const,
                    event:
                        settlement.status === "paid"
                            ? "merchant_settlement.paid"
                            : "merchant_settlement.locked",
                    oldValues: null,
                    newValues: {
                        merchantSettlementId: settlement.id,
                        merchantSettlementStatus: settlement.status,
                    },
                })),
            );
        }

        return { settlementId: settlement.id, merchantId: settlement.merchantId };
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
            .update(merchantFinancialItems)
            .set({
                lifecycleState: "closed",
                updatedAt: new Date(),
            })
            .where(eq(merchantFinancialItems.merchantSettlementId, input.settlementId))
            .returning({
                sourceParcelId: merchantFinancialItems.sourceParcelId,
            });

        const affectedParcelIds = Array.from(
            new Set(
                settledRows
                    .map((row) => row.sourceParcelId)
                    .filter((value): value is string => Boolean(value)),
            ),
        );

        await syncLegacyParcelSettlementStateForParcelsWithClient(tx, affectedParcelIds);

        if (affectedParcelIds.length > 0) {
            await tx.insert(parcelAuditLogs).values(
                affectedParcelIds.map((parcelId) => ({
                    parcelId,
                    updatedBy: input.actorAppUserId,
                    sourceTable: "parcel_payment_records" as const,
                    event: "merchant_settlement.paid",
                    oldValues: null,
                    newValues: {
                        merchantSettlementId: input.settlementId,
                        merchantSettlementStatus: "paid",
                    },
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
            .update(merchantFinancialItems)
            .set({
                merchantSettlementId: null,
                lifecycleState: "open",
                updatedAt: new Date(),
            })
            .where(eq(merchantFinancialItems.merchantSettlementId, input.settlementId))
            .returning({
                sourceParcelId: merchantFinancialItems.sourceParcelId,
            });

        const affectedParcelIds = Array.from(
            new Set(
                releasedRows
                    .map((row) => row.sourceParcelId)
                    .filter((value): value is string => Boolean(value)),
            ),
        );

        for (const parcelId of affectedParcelIds) {
            await reconcileMerchantFinancialItemsForParcelWithClient(tx, parcelId);
        }

        if (affectedParcelIds.length > 0) {
            await tx.insert(parcelAuditLogs).values(
                affectedParcelIds.map((parcelId) => ({
                    parcelId,
                    updatedBy: input.actorAppUserId,
                    sourceTable: "parcel_payment_records" as const,
                    event: `merchant_settlement.${input.status}`,
                    oldValues: { merchantSettlementId: input.settlementId },
                    newValues: { merchantSettlementId: null, merchantSettlementStatus: "pending" },
                })),
            );
        }

        return { settlementId: settlement.id, merchantId: settlement.merchantId };
    });
}
