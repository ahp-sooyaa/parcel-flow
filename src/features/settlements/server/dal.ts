import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import {
  appUsers,
  bankAccounts,
  financialItems,
  merchantSettlements,
  merchants,
  parcels,
  riders,
} from "@/db/schema";
import type {
  RiderCashHandoverListRowDto,
  RiderCashHandoverParcelDto,
  RiderCashHandoverSummaryDto,
  MerchantSettlementHistoryFiltersDto,
  MerchantSettlementHistoryItemDto,
  MerchantSettlementHistoryPageDto,
  SettlementEligibleFinancialItemDto,
  SettlementEligibleMerchantDto,
  SettlementEligibleMerchantSummaryDto,
  SettlementWorkspaceSummaryDto,
  SettlementListItemDto,
  SettlementListFiltersDto,
  SettlementListPageDto,
} from "@/features/settlements/server/dto";
import {
  calculateMerchantSettlementTotals,
  formatBankAccountSummary,
  generateUniqueSettlementCode,
  merchantSettlementEligibleItemTypes,
} from "@/features/settlements/server/utils";
import { CACHE_TAGS, merchantSettlementsTag } from "@/lib/cache-tags";

function mapEligibleFinancialItem(row: {
  itemId: string;
  parcelId: string | null;
  parcelCode: string | null;
  itemType: "cod_remit" | "delivery_fee_deduction";
  amount: number;
  createdAt: Date;
}): SettlementEligibleFinancialItemDto {
  return {
    id: row.itemId,
    parcelId: row.parcelId,
    parcelCode: row.parcelCode,
    itemType: row.itemType,
    amount: row.amount,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapRiderCashHandoverParcel(row: {
  parcelId: string;
  parcelCode: string;
  merchantName: string;
  parcelType: string;
  codAmount: number;
  deliveryFee: number;
  collectedAmount: number;
  deliveredAt: Date | null;
}): RiderCashHandoverParcelDto {
  return {
    id: row.parcelId,
    parcelCode: row.parcelCode,
    merchantName: row.merchantName,
    parcelType: row.parcelType === "non_cod" ? "non_cod" : "cod",
    codAmount: row.codAmount,
    deliveryFee: row.deliveryFee,
    collectedAmount: row.collectedAmount,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
  };
}

function buildSettlementEligibleFinancialItemsWhere() {
  return and(
    isNull(financialItems.merchantSettlementId),
    eq(financialItems.status, "pending"),
    inArray(financialItems.itemType, merchantSettlementEligibleItemTypes),
    or(
      eq(financialItems.itemType, "delivery_fee_deduction"),
      and(eq(financialItems.itemType, "cod_remit"), eq(parcels.isReceivedByOffice, true)),
    ),
  );
}

function mapSettlementEligibleMerchantFromRows(
  rows: Array<{
    merchantId: string;
    merchantName: string;
    bankName: string | null;
    accountNumber: string | null;
    itemId: string;
    parcelId: string | null;
    parcelCode: string | null;
    itemType: string;
    amount: number;
    createdAt: Date;
  }>,
): SettlementEligibleMerchantDto | null {
  if (rows.length === 0) {
    return null;
  }

  const firstRow = rows[0];
  const merchant: SettlementEligibleMerchantDto = {
    merchantId: firstRow.merchantId,
    merchantName: firstRow.merchantName,
    bankAccountSummary: formatBankAccountSummary({
      bankName: firstRow.bankName,
      accountNumber: firstRow.accountNumber,
    }),
    eligibleItemCount: 0,
    totalCodAmount: 0,
    totalDeliveryFeeDeduction: 0,
    netPaymentAmount: 0,
    financialItems: [],
  };

  for (const row of rows) {
    if (row.itemType !== "cod_remit" && row.itemType !== "delivery_fee_deduction") {
      continue;
    }

    merchant.financialItems.push(
      mapEligibleFinancialItem({
        itemId: row.itemId,
        parcelId: row.parcelId,
        parcelCode: row.parcelCode,
        itemType: row.itemType,
        amount: row.amount,
        createdAt: row.createdAt,
      }),
    );
    merchant.eligibleItemCount += 1;

    if (row.itemType === "cod_remit") {
      merchant.totalCodAmount += row.amount;
    } else {
      merchant.totalDeliveryFeeDeduction += row.amount;
    }
  }

  merchant.netPaymentAmount = merchant.totalCodAmount - merchant.totalDeliveryFeeDeduction;

  return merchant.totalCodAmount > 0 ? merchant : null;
}

export async function listEligibleSettlementMerchantSummaries(): Promise<
  SettlementEligibleMerchantSummaryDto[]
> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.settlementWorkspace, CACHE_TAGS.settlements, CACHE_TAGS.parcels);

  const rows = await db
    .select({
      merchantId: merchants.id,
      merchantName: merchants.shopName,
      bankName: bankAccounts.bankName,
      accountNumber: bankAccounts.accountNumber,
      eligibleItemCount: sql<number>`count(${financialItems.id})`,
      totalCodAmount: sql<number>`coalesce(sum(case when ${financialItems.itemType} = 'cod_remit' then ${financialItems.amount} else 0 end), 0)`,
      totalDeliveryFeeDeduction: sql<number>`coalesce(sum(case when ${financialItems.itemType} = 'delivery_fee_deduction' then ${financialItems.amount} else 0 end), 0)`,
    })
    .from(financialItems)
    .innerJoin(merchants, eq(merchants.id, financialItems.merchantId))
    .leftJoin(parcels, eq(parcels.id, financialItems.parcelId))
    .leftJoin(
      bankAccounts,
      and(
        eq(bankAccounts.userId, merchants.userId),
        eq(bankAccounts.isPrimary, true),
        isNull(bankAccounts.deletedAt),
      ),
    )
    .where(buildSettlementEligibleFinancialItemsWhere())
    .groupBy(merchants.id, merchants.shopName, bankAccounts.bankName, bankAccounts.accountNumber)
    .orderBy(asc(merchants.shopName));

  return rows
    .map((row) => {
      const totalCodAmount = row.totalCodAmount;
      const totalDeliveryFeeDeduction = row.totalDeliveryFeeDeduction;

      return {
        merchantId: row.merchantId,
        merchantName: row.merchantName,
        bankAccountSummary: formatBankAccountSummary({
          bankName: row.bankName,
          accountNumber: row.accountNumber,
        }),
        eligibleItemCount: row.eligibleItemCount,
        totalCodAmount,
        totalDeliveryFeeDeduction,
        netPaymentAmount: totalCodAmount - totalDeliveryFeeDeduction,
      };
    })
    .filter((merchant) => merchant.totalCodAmount > 0);
}

export async function getEligibleSettlementMerchantById(
  merchantId: string,
): Promise<SettlementEligibleMerchantDto | null> {
  const rows = await db
    .select({
      merchantId: merchants.id,
      merchantName: merchants.shopName,
      bankName: bankAccounts.bankName,
      accountNumber: bankAccounts.accountNumber,
      itemId: financialItems.id,
      parcelId: financialItems.parcelId,
      parcelCode: parcels.parcelCode,
      itemType: financialItems.itemType,
      amount: financialItems.amount,
      createdAt: financialItems.createdAt,
    })
    .from(financialItems)
    .innerJoin(merchants, eq(merchants.id, financialItems.merchantId))
    .leftJoin(parcels, eq(parcels.id, financialItems.parcelId))
    .leftJoin(
      bankAccounts,
      and(
        eq(bankAccounts.userId, merchants.userId),
        eq(bankAccounts.isPrimary, true),
        isNull(bankAccounts.deletedAt),
      ),
    )
    .where(and(buildSettlementEligibleFinancialItemsWhere(), eq(merchants.id, merchantId)))
    .orderBy(asc(financialItems.createdAt));

  return mapSettlementEligibleMerchantFromRows(rows);
}

export async function listPendingRiderCashHandoverSummaries(): Promise<
  RiderCashHandoverSummaryDto[]
> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.settlementWorkspace, CACHE_TAGS.settlements, CACHE_TAGS.parcels);

  const rows = await db
    .select({
      riderId: riders.id,
      riderName: appUsers.name,
      pendingParcelCount: sql<number>`count(*)`,
      totalCodAmount: sql<number>`coalesce(sum(case when ${parcels.parcelType} = 'cod' then ${parcels.codAmount} else 0 end), 0)`,
      totalDeliveryFeeAmount: sql<number>`coalesce(sum(${parcels.deliveryFee}), 0)`,
      totalCollectedAmount: sql<number>`coalesce(sum(${parcels.collectedAmount}), 0)`,
    })
    .from(parcels)
    .innerJoin(riders, eq(riders.id, parcels.riderId))
    .innerJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(
      and(
        isNull(parcels.deletedAt),
        eq(parcels.status, "delivered"),
        eq(parcels.isReceivedByOffice, false),
      ),
    )
    .groupBy(riders.id, appUsers.name)
    .orderBy(asc(appUsers.name));

  return rows.map((row) => ({
    riderId: row.riderId,
    riderName: row.riderName,
    pendingParcelCount: row.pendingParcelCount,
    totalCodAmount: row.totalCodAmount,
    totalDeliveryFeeAmount: row.totalDeliveryFeeAmount,
    totalCollectedAmount: row.totalCollectedAmount,
  }));
}

export async function getPendingRiderCashHandoverByRiderId(
  riderId: string,
): Promise<RiderCashHandoverListRowDto | null> {
  const rows = await db
    .select({
      riderId: riders.id,
      riderName: appUsers.name,
      parcelId: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantName: merchants.shopName,
      parcelType: parcels.parcelType,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      collectedAmount: parcels.collectedAmount,
      deliveredAt: parcels.deliveredAt,
    })
    .from(parcels)
    .innerJoin(riders, eq(riders.id, parcels.riderId))
    .innerJoin(appUsers, eq(appUsers.id, riders.userId))
    .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
    .where(
      and(
        eq(riders.id, riderId),
        isNull(parcels.deletedAt),
        eq(parcels.status, "delivered"),
        eq(parcels.isReceivedByOffice, false),
      ),
    )
    .orderBy(asc(parcels.deliveredAt), asc(parcels.parcelCode));

  if (rows.length === 0) {
    return null;
  }

  const handover: RiderCashHandoverListRowDto = {
    riderId: rows[0].riderId,
    riderName: rows[0].riderName,
    pendingParcelCount: 0,
    totalCodAmount: 0,
    totalDeliveryFeeAmount: 0,
    totalCollectedAmount: 0,
    parcels: [],
  };

  for (const row of rows) {
    const parcel = mapRiderCashHandoverParcel(row);
    handover.pendingParcelCount += 1;
    handover.totalCodAmount += parcel.parcelType === "cod" ? parcel.codAmount : 0;
    handover.totalDeliveryFeeAmount += parcel.deliveryFee;
    handover.totalCollectedAmount += parcel.collectedAmount;
    handover.parcels.push(parcel);
  }

  return handover;
}

export async function getSettlementWorkspaceSummary(): Promise<SettlementWorkspaceSummaryDto> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.settlementWorkspace, CACHE_TAGS.settlements, CACHE_TAGS.parcels);

  const [eligibleMerchants, riderHandovers] = await Promise.all([
    listEligibleSettlementMerchantSummaries(),
    listPendingRiderCashHandoverSummaries(),
  ]);

  return { merchants: eligibleMerchants, riderHandovers };
}

export async function listEligibleSettlementMerchants(): Promise<SettlementEligibleMerchantDto[]> {
  const rows = await db
    .select({
      merchantId: merchants.id,
      merchantName: merchants.shopName,
      bankName: bankAccounts.bankName,
      accountNumber: bankAccounts.accountNumber,
      itemId: financialItems.id,
      parcelId: financialItems.parcelId,
      parcelCode: parcels.parcelCode,
      itemType: financialItems.itemType,
      amount: financialItems.amount,
      createdAt: financialItems.createdAt,
    })
    .from(financialItems)
    .innerJoin(merchants, eq(merchants.id, financialItems.merchantId))
    .leftJoin(parcels, eq(parcels.id, financialItems.parcelId))
    .leftJoin(
      bankAccounts,
      and(
        eq(bankAccounts.userId, merchants.userId),
        eq(bankAccounts.isPrimary, true),
        isNull(bankAccounts.deletedAt),
      ),
    )
    .where(buildSettlementEligibleFinancialItemsWhere())
    .orderBy(asc(merchants.shopName), asc(financialItems.createdAt));

  const merchantMap = new Map<string, SettlementEligibleMerchantDto>();

  for (const row of rows) {
    let merchant = merchantMap.get(row.merchantId);

    if (!merchant) {
      merchant = {
        merchantId: row.merchantId,
        merchantName: row.merchantName,
        bankAccountSummary: formatBankAccountSummary({
          bankName: row.bankName,
          accountNumber: row.accountNumber,
        }),
        eligibleItemCount: 0,
        totalCodAmount: 0,
        totalDeliveryFeeDeduction: 0,
        netPaymentAmount: 0,
        financialItems: [],
      };
      merchantMap.set(row.merchantId, merchant);
    }

    if (row.itemType !== "cod_remit" && row.itemType !== "delivery_fee_deduction") {
      continue;
    }

    merchant.financialItems.push(
      mapEligibleFinancialItem({
        itemId: row.itemId,
        parcelId: row.parcelId,
        parcelCode: row.parcelCode,
        itemType: row.itemType,
        amount: row.amount,
        createdAt: row.createdAt,
      }),
    );
    merchant.eligibleItemCount += 1;

    if (row.itemType === "cod_remit") {
      merchant.totalCodAmount += row.amount;
    } else {
      merchant.totalDeliveryFeeDeduction += row.amount;
    }

    merchant.netPaymentAmount = merchant.totalCodAmount - merchant.totalDeliveryFeeDeduction;
  }

  return Array.from(merchantMap.values()).filter((merchant) => merchant.totalCodAmount > 0);
}

export async function listPendingRiderCashHandovers(): Promise<RiderCashHandoverListRowDto[]> {
  const rows = await db
    .select({
      riderId: riders.id,
      riderName: appUsers.name,
      parcelId: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantName: merchants.shopName,
      parcelType: parcels.parcelType,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      collectedAmount: parcels.collectedAmount,
      deliveredAt: parcels.deliveredAt,
    })
    .from(parcels)
    .innerJoin(riders, eq(riders.id, parcels.riderId))
    .innerJoin(appUsers, eq(appUsers.id, riders.userId))
    .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
    .where(
      and(
        isNull(parcels.deletedAt),
        eq(parcels.status, "delivered"),
        eq(parcels.isReceivedByOffice, false),
      ),
    )
    .orderBy(asc(appUsers.name), asc(parcels.deliveredAt), asc(parcels.parcelCode));

  const riderMap = new Map<string, RiderCashHandoverListRowDto>();

  for (const row of rows) {
    const parcel = mapRiderCashHandoverParcel(row);
    const existing = riderMap.get(row.riderId);

    if (!existing) {
      riderMap.set(row.riderId, {
        riderId: row.riderId,
        riderName: row.riderName,
        pendingParcelCount: 1,
        totalCodAmount: parcel.parcelType === "cod" ? parcel.codAmount : 0,
        totalDeliveryFeeAmount: parcel.deliveryFee,
        totalCollectedAmount: parcel.collectedAmount,
        parcels: [parcel],
      });
      continue;
    }

    existing.pendingParcelCount += 1;
    existing.totalCodAmount += parcel.parcelType === "cod" ? parcel.codAmount : 0;
    existing.totalDeliveryFeeAmount += parcel.deliveryFee;
    existing.totalCollectedAmount += parcel.collectedAmount;
    existing.parcels.push(parcel);
  }

  return Array.from(riderMap.values());
}

export async function listSettlementsPage(
  filters: SettlementListFiltersDto,
): Promise<SettlementListPageDto> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.settlements);

  const totalCountRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(merchantSettlements)
    .then((rows) => rows[0]);

  const totalCount = totalCountRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const offset = (page - 1) * filters.pageSize;

  const rows = await db
    .select({
      id: merchantSettlements.id,
      settlementCode: merchantSettlements.settlementCode,
      merchantId: merchants.id,
      merchantName: merchants.shopName,
      status: merchantSettlements.status,
      totalCodAmount: merchantSettlements.totalCodAmount,
      totalDeliveryFeeDeduction: merchantSettlements.totalDeliveryFeeDeduction,
      netPaymentAmount: merchantSettlements.netPaymentAmount,
      bankName: bankAccounts.bankName,
      accountNumber: bankAccounts.accountNumber,
      bankTransferReceiptKey: merchantSettlements.bankTransferReceiptKey,
      paidAt: merchantSettlements.paidAt,
      createdAt: merchantSettlements.createdAt,
    })
    .from(merchantSettlements)
    .innerJoin(merchants, eq(merchants.id, merchantSettlements.merchantId))
    .leftJoin(bankAccounts, eq(bankAccounts.id, merchantSettlements.bankAccountId))
    .orderBy(desc(merchantSettlements.createdAt))
    .limit(filters.pageSize)
    .offset(offset);

  return {
    settlements: rows.map(mapSettlementListItem),
    page,
    pageSize: filters.pageSize,
    totalCount,
    totalPages,
  };
}

export async function listSettlements(): Promise<SettlementListItemDto[]> {
  const page = await listSettlementsPage({ page: 1, pageSize: 10_000 });
  return page.settlements;
}

function mapSettlementListItem(row: {
  id: string;
  settlementCode: string;
  merchantId: string;
  merchantName: string;
  status: string;
  totalCodAmount: number;
  totalDeliveryFeeDeduction: number;
  netPaymentAmount: number;
  bankName: string | null;
  accountNumber: string | null;
  bankTransferReceiptKey: string | null;
  paidAt: Date | null;
  createdAt: Date;
}): SettlementListItemDto {
  return {
    id: row.id,
    settlementCode: row.settlementCode,
    merchantId: row.merchantId,
    merchantName: row.merchantName,
    status:
      row.status === "pending" || row.status === "settled" || row.status === "void"
        ? row.status
        : "pending",
    totalCodAmount: row.totalCodAmount,
    totalDeliveryFeeDeduction: row.totalDeliveryFeeDeduction,
    netPaymentAmount: row.netPaymentAmount,
    bankAccountSummary: formatBankAccountSummary({
      bankName: row.bankName,
      accountNumber: row.accountNumber,
    }),
    bankTransferReceiptKey: row.bankTransferReceiptKey,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listMerchantSettlementHistoryForUser(
  userId: string,
  filters: MerchantSettlementHistoryFiltersDto,
): Promise<MerchantSettlementHistoryPageDto> {
  "use cache";
  cacheLife("minutes");
  cacheTag(merchantSettlementsTag(userId), CACHE_TAGS.settlements);

  const baseWhere = and(eq(merchants.userId, userId), eq(merchantSettlements.status, "settled"));
  const filteredWhere = buildMerchantSettlementHistoryWhere(userId, filters);

  const [hasAnySettledRow, totalCountRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(merchantSettlements)
      .innerJoin(merchants, eq(merchants.id, merchantSettlements.merchantId))
      .where(baseWhere)
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(merchantSettlements)
      .innerJoin(merchants, eq(merchants.id, merchantSettlements.merchantId))
      .where(filteredWhere)
      .then((rows) => rows[0]),
  ]);

  const hasAnySettledSettlements = (hasAnySettledRow?.count ?? 0) > 0;
  const totalCount = totalCountRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const offset = (page - 1) * filters.pageSize;

  const rows = await db
    .select({
      id: merchantSettlements.id,
      settlementCode: merchantSettlements.settlementCode,
      status: merchantSettlements.status,
      totalCodAmount: merchantSettlements.totalCodAmount,
      totalDeliveryFeeDeduction: merchantSettlements.totalDeliveryFeeDeduction,
      netPaymentAmount: merchantSettlements.netPaymentAmount,
      paidAt: merchantSettlements.paidAt,
      createdAt: merchantSettlements.createdAt,
    })
    .from(merchantSettlements)
    .innerJoin(merchants, eq(merchants.id, merchantSettlements.merchantId))
    .where(filteredWhere)
    .orderBy(desc(merchantSettlements.createdAt), desc(merchantSettlements.settlementCode))
    .limit(filters.pageSize)
    .offset(offset);

  return {
    settlements: rows.map(mapMerchantSettlementHistoryItem),
    page,
    pageSize: filters.pageSize,
    totalCount,
    totalPages,
    hasAnySettledSettlements,
  };
}

export async function createMerchantSettlement(input: {
  merchantId: string;
  financialItemIds: string[];
  createdBy: string;
}) {
  const uniqueFinancialItemIds = Array.from(new Set(input.financialItemIds));

  return db.transaction(async (tx) => {
    const [merchant] = await tx
      .select({
        id: merchants.id,
        userId: merchants.userId,
      })
      .from(merchants)
      .where(eq(merchants.id, input.merchantId))
      .limit(1);

    if (!merchant) {
      throw new Error("Merchant was not found.");
    }

    const eligibleItems = await tx
      .select({
        id: financialItems.id,
        merchantId: financialItems.merchantId,
        parcelId: financialItems.parcelId,
        itemType: financialItems.itemType,
        amount: financialItems.amount,
      })
      .from(financialItems)
      .where(
        and(
          inArray(financialItems.id, uniqueFinancialItemIds),
          eq(financialItems.merchantId, input.merchantId),
          isNull(financialItems.merchantSettlementId),
          eq(financialItems.status, "pending"),
          inArray(financialItems.itemType, merchantSettlementEligibleItemTypes),
        ),
      );

    if (eligibleItems.length !== uniqueFinancialItemIds.length) {
      throw new Error(
        "One or more selected financial items are no longer eligible for settlement.",
      );
    }

    const typedEligibleItems = eligibleItems.filter(
      (
        item,
      ): item is typeof item & {
        itemType: "cod_remit" | "delivery_fee_deduction";
      } => item.itemType === "cod_remit" || item.itemType === "delivery_fee_deduction",
    );
    const totals = calculateMerchantSettlementTotals(
      typedEligibleItems.map((item) => ({ itemType: item.itemType, amount: item.amount })),
    );

    if (totals.totalCodAmount <= 0 || totals.netPaymentAmount < 0) {
      throw new Error("Delivery fee deductions exceed the selected COD total.");
    }

    const [primaryBankAccount] = merchant.userId
      ? await tx
          .select({ id: bankAccounts.id })
          .from(bankAccounts)
          .where(
            and(
              eq(bankAccounts.userId, merchant.userId),
              eq(bankAccounts.isPrimary, true),
              isNull(bankAccounts.deletedAt),
            ),
          )
          .limit(1)
      : [];

    const settlementCode = await generateUniqueSettlementCode(tx);
    const now = new Date();
    const [settlement] = await tx
      .insert(merchantSettlements)
      .values({
        settlementCode,
        merchantId: input.merchantId,
        status: "pending",
        totalCodAmount: totals.totalCodAmount,
        totalDeliveryFeeDeduction: totals.totalDeliveryFeeDeduction,
        netPaymentAmount: totals.netPaymentAmount,
        bankAccountId: primaryBankAccount?.id ?? null,
        createdBy: input.createdBy,
        updatedAt: now,
      })
      .returning({
        id: merchantSettlements.id,
        settlementCode: merchantSettlements.settlementCode,
      });

    const reservedItems = await tx
      .update(financialItems)
      .set({
        merchantSettlementId: settlement.id,
        status: "in_progress",
        updatedAt: now,
      })
      .where(
        and(
          inArray(financialItems.id, uniqueFinancialItemIds),
          isNull(financialItems.merchantSettlementId),
          eq(financialItems.status, "pending"),
        ),
      )
      .returning({ id: financialItems.id });

    if (reservedItems.length !== uniqueFinancialItemIds.length) {
      throw new Error(
        "One or more selected financial items are no longer eligible for settlement.",
      );
    }

    const parcelIds = eligibleItems
      .map((item) => item.parcelId)
      .filter((parcelId): parcelId is string => parcelId !== null);

    if (parcelIds.length > 0) {
      await tx
        .update(parcels)
        .set({
          merchantSettlementStatus: "in_progress",
          updatedAt: now,
        })
        .where(inArray(parcels.id, parcelIds));
    }

    return settlement;
  });
}

export async function confirmRiderCashHandover(input: {
  riderId: string;
  parcelIds: string[];
  confirmedBy: string;
}) {
  const uniqueParcelIds = Array.from(new Set(input.parcelIds));

  return db.transaction(async (tx) => {
    const eligibleParcels = await tx
      .select({
        id: parcels.id,
        riderId: parcels.riderId,
        merchantId: parcels.merchantId,
        status: parcels.status,
        isReceivedByOffice: parcels.isReceivedByOffice,
        parcelType: parcels.parcelType,
        codAmount: parcels.codAmount,
      })
      .from(parcels)
      .where(and(inArray(parcels.id, uniqueParcelIds), isNull(parcels.deletedAt)));

    if (eligibleParcels.length !== uniqueParcelIds.length) {
      throw new Error("One or more selected parcels are no longer eligible for handover.");
    }

    const hasInvalidParcel = eligibleParcels.some(
      (parcel) =>
        parcel.riderId !== input.riderId ||
        parcel.status !== "delivered" ||
        parcel.isReceivedByOffice,
    );

    if (hasInvalidParcel) {
      throw new Error("One or more selected parcels are no longer eligible for handover.");
    }

    const now = new Date();
    const updatedParcels = await tx
      .update(parcels)
      .set({
        isReceivedByOffice: true,
        collectionConfirmedBy: input.confirmedBy,
        updatedAt: now,
      })
      .where(
        and(
          inArray(parcels.id, uniqueParcelIds),
          eq(parcels.riderId, input.riderId),
          eq(parcels.status, "delivered"),
          eq(parcels.isReceivedByOffice, false),
        ),
      )
      .returning({ id: parcels.id });

    if (updatedParcels.length !== uniqueParcelIds.length) {
      throw new Error("One or more selected parcels are no longer eligible for handover.");
    }

    const codParcelIds = eligibleParcels
      .filter((parcel) => parcel.parcelType === "cod")
      .map((parcel) => parcel.id);
    const existingCodRemitItems =
      codParcelIds.length > 0
        ? await tx
            .select({ parcelId: financialItems.parcelId })
            .from(financialItems)
            .where(
              and(
                inArray(financialItems.parcelId, codParcelIds),
                eq(financialItems.itemType, "cod_remit"),
              ),
            )
        : [];
    const existingCodRemitParcelIds = new Set(
      existingCodRemitItems
        .map((item) => item.parcelId)
        .filter((parcelId): parcelId is string => parcelId !== null),
    );
    const pendingCodRemitItems = eligibleParcels
      .filter((parcel) => parcel.parcelType === "cod" && !existingCodRemitParcelIds.has(parcel.id))
      .map((parcel) => ({
        parcelId: parcel.id,
        merchantId: parcel.merchantId,
        riderId: null,
        itemType: "cod_remit" as const,
        amount: parcel.codAmount,
        status: "pending" as const,
        createdBy: input.confirmedBy,
        updatedAt: now,
      }));

    if (pendingCodRemitItems.length > 0) {
      await tx.insert(financialItems).values(pendingCodRemitItems);
    }

    return {
      confirmedParcelCount: uniqueParcelIds.length,
      createdCodRemitCount: pendingCodRemitItems.length,
    };
  });
}

export async function resolveMerchantSettlement(input: {
  settlementId: string;
  bankTransferReceiptKey: string;
  paymentNote?: string;
  paidBy: string;
}) {
  return db.transaction(async (tx) => {
    const [settlement] = await tx
      .select({
        id: merchantSettlements.id,
        status: merchantSettlements.status,
      })
      .from(merchantSettlements)
      .where(eq(merchantSettlements.id, input.settlementId))
      .limit(1);

    if (!settlement) {
      throw new Error("Settlement was not found.");
    }

    if (settlement.status !== "pending") {
      throw new Error("Only pending settlements can be resolved.");
    }

    const linkedItems = await tx
      .select({
        id: financialItems.id,
        parcelId: financialItems.parcelId,
      })
      .from(financialItems)
      .where(eq(financialItems.merchantSettlementId, input.settlementId));

    if (linkedItems.length === 0) {
      throw new Error("Settlement does not have any linked financial items.");
    }

    const now = new Date();

    const [updatedSettlement] = await tx
      .update(merchantSettlements)
      .set({
        status: "settled",
        bankTransferReceiptKey: input.bankTransferReceiptKey,
        bankTransferReceiptUploadedAt: now,
        bankTransferReceiptUploadedBy: input.paidBy,
        paidBy: input.paidBy,
        paidAt: now,
        paymentNote: input.paymentNote?.trim() ? input.paymentNote.trim() : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(merchantSettlements.id, input.settlementId),
          eq(merchantSettlements.status, "pending"),
        ),
      )
      .returning({ id: merchantSettlements.id });

    if (!updatedSettlement) {
      throw new Error("Only pending settlements can be resolved.");
    }

    await tx
      .update(financialItems)
      .set({
        status: "settled",
        settledAt: now,
        updatedAt: now,
      })
      .where(eq(financialItems.merchantSettlementId, input.settlementId));

    const parcelIds = linkedItems
      .map((item) => item.parcelId)
      .filter((parcelId): parcelId is string => parcelId !== null);

    if (parcelIds.length > 0) {
      await tx
        .update(parcels)
        .set({
          merchantSettlementStatus: "settled",
          updatedAt: now,
        })
        .where(inArray(parcels.id, parcelIds));
    }
  });
}

function buildMerchantSettlementHistoryWhere(
  userId: string,
  filters: MerchantSettlementHistoryFiltersDto,
) {
  const createdAtRange = filters.createdOn ? getDayRange(filters.createdOn) : null;
  const normalizedSearchTerm = filters.searchTerm.trim();

  return and(
    eq(merchants.userId, userId),
    eq(merchantSettlements.status, "settled"),
    normalizedSearchTerm
      ? ilike(merchantSettlements.settlementCode, `%${normalizedSearchTerm}%`)
      : undefined,
    createdAtRange
      ? and(
          gte(merchantSettlements.createdAt, createdAtRange.start),
          lt(merchantSettlements.createdAt, createdAtRange.end),
        )
      : undefined,
  );
}

function mapMerchantSettlementHistoryItem(row: {
  id: string;
  settlementCode: string;
  status: string;
  totalCodAmount: number;
  totalDeliveryFeeDeduction: number;
  netPaymentAmount: number;
  paidAt: Date | null;
  createdAt: Date;
}): MerchantSettlementHistoryItemDto {
  return {
    id: row.id,
    settlementCode: row.settlementCode,
    status: row.status === "settled" ? "settled" : "pending",
    totalCodAmount: row.totalCodAmount,
    totalDeliveryFeeDeduction: row.totalDeliveryFeeDeduction,
    netPaymentAmount: row.netPaymentAmount,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function getDayRange(day: string) {
  const start = new Date(`${day}T00:00:00+07:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}
