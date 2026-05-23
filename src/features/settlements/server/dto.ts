import { z } from "zod";

import type { FinancialItemType, SettlementStatus } from "@/lib/domain";

export const createMerchantSettlementInputSchema = z.object({
  merchantId: z.uuid("Merchant selection is invalid."),
  financialItemIds: z
    .array(z.uuid("Financial item selection is invalid."))
    .min(1, "Select at least one financial item."),
});

export const maxSettlementReceiptSize = 8 * 1024 * 1024;
export const allowedSettlementReceiptTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const resolveMerchantSettlementInputSchema = z.object({
  settlementId: z.uuid("Settlement selection is invalid."),
  paymentNote: z
    .string()
    .trim()
    .max(500, "Payment note must be 500 characters or fewer.")
    .optional(),
  bankTransferReceipt: z
    .file("Bank transfer receipt is required.")
    .min(1, "Bank transfer receipt is required.")
    .max(maxSettlementReceiptSize, "Bank transfer receipt must be 8MB or smaller.")
    .mime(
      [...allowedSettlementReceiptTypes],
      "Bank transfer receipt must be a PDF, JPG, PNG, or WebP file.",
    ),
});

export type SettlementEligibleFinancialItemDto = {
  id: string;
  parcelId: string | null;
  parcelCode: string | null;
  itemType: Extract<FinancialItemType, "cod_remit" | "delivery_fee_deduction">;
  amount: number;
  createdAt: string;
};

export type SettlementEligibleMerchantDto = {
  merchantId: string;
  merchantName: string;
  bankAccountSummary: string | null;
  eligibleItemCount: number;
  totalCodAmount: number;
  totalDeliveryFeeDeduction: number;
  netPaymentAmount: number;
  financialItems: SettlementEligibleFinancialItemDto[];
};

export type SettlementListItemDto = {
  id: string;
  settlementCode: string;
  merchantId: string;
  merchantName: string;
  status: SettlementStatus;
  totalCodAmount: number;
  totalDeliveryFeeDeduction: number;
  netPaymentAmount: number;
  bankAccountSummary: string | null;
  bankTransferReceiptKey: string | null;
  paidAt: string | null;
  createdAt: string;
};

const merchantSettlementHistorySearchParamsSchema = z.object({
  query: z.string().trim().max(100).optional().catch(""),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date filter must use YYYY-MM-DD format.")
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(1),
});

export type MerchantSettlementHistoryFiltersDto = {
  searchTerm: string;
  createdOn: string | null;
  page: number;
  pageSize: number;
};

export type MerchantSettlementHistoryItemDto = {
  id: string;
  settlementCode: string;
  status: SettlementStatus;
  totalCodAmount: number;
  totalDeliveryFeeDeduction: number;
  netPaymentAmount: number;
  paidAt: string | null;
  createdAt: string;
};

export type MerchantSettlementHistoryPageDto = {
  settlements: MerchantSettlementHistoryItemDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasAnySettledSettlements: boolean;
};

export const merchantSettlementHistoryPageSize = 10;

export function parseMerchantSettlementHistoryFilters(
  input: Record<string, string | string[] | undefined>,
) {
  const parseResult = merchantSettlementHistorySearchParamsSchema.safeParse({
    query: readSearchParam(input.query),
    date: readSearchParam(input.date),
    page: readSearchParam(input.page),
  });

  if (!parseResult.success) {
    return {
      searchTerm: "",
      createdOn: null,
      page: 1,
      pageSize: merchantSettlementHistoryPageSize,
    } satisfies MerchantSettlementHistoryFiltersDto;
  }

  return {
    searchTerm: parseResult.data.query ?? "",
    createdOn: parseResult.data.date ?? null,
    page: parseResult.data.page ?? 1,
    pageSize: merchantSettlementHistoryPageSize,
  } satisfies MerchantSettlementHistoryFiltersDto;
}

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
