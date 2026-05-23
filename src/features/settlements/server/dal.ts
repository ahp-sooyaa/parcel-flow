import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  bankAccounts,
  financialItems,
  merchantSettlements,
  merchants,
  parcels,
} from "@/db/schema";
import type {
  SettlementEligibleFinancialItemDto,
  SettlementEligibleMerchantDto,
  SettlementListItemDto,
} from "@/features/settlements/server/dto";
import {
  calculateMerchantSettlementTotals,
  formatBankAccountSummary,
  generateUniqueSettlementCode,
  merchantSettlementEligibleItemTypes,
} from "@/features/settlements/server/utils";

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
    .where(
      and(
        isNull(financialItems.merchantSettlementId),
        eq(financialItems.status, "pending"),
        inArray(financialItems.itemType, merchantSettlementEligibleItemTypes),
      ),
    )
    .orderBy(asc(merchants.shopName), asc(financialItems.createdAt));

  const merchantMap = new Map<string, SettlementEligibleMerchantDto>();

  for (const row of rows) {
    const existingMerchant = merchantMap.get(row.merchantId);

    if (!existingMerchant) {
      merchantMap.set(row.merchantId, {
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
      });
    }

    const merchant = merchantMap.get(row.merchantId);

    if (!merchant || (row.itemType !== "cod_remit" && row.itemType !== "delivery_fee_deduction")) {
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

    const totals = calculateMerchantSettlementTotals(
      merchant.financialItems.map((item) => ({
        itemType: item.itemType,
        amount: item.amount,
      })),
    );
    merchant.totalCodAmount = totals.totalCodAmount;
    merchant.totalDeliveryFeeDeduction = totals.totalDeliveryFeeDeduction;
    merchant.netPaymentAmount = totals.netPaymentAmount;
  }

  return Array.from(merchantMap.values()).filter((merchant) => merchant.totalCodAmount > 0);
}

export async function listSettlements(): Promise<SettlementListItemDto[]> {
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
    .orderBy(desc(merchantSettlements.createdAt));

  return rows.map((row) => ({
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
  }));
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
      (item): item is typeof item & {
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
        and(eq(merchantSettlements.id, input.settlementId), eq(merchantSettlements.status, "pending")),
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
