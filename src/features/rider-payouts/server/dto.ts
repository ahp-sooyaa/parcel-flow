import { z } from "zod";

import type { RiderWaySource } from "@/lib/domain";

export const createRiderPayoutDraftInputSchema = z.object({
  riderId: z.uuid("Rider selection is invalid."),
  financialItemIds: z
    .array(z.uuid("Financial item selection is invalid."))
    .min(1, "Select at least one rider way item."),
  feePerWay: z.coerce.number().int().min(1, "Fee per way must be greater than zero."),
});

export const settleRiderPayoutInputSchema = z.object({
  payoutId: z.uuid("Rider payout selection is invalid."),
  paymentNote: z
    .string()
    .trim()
    .max(500, "Payment note must be 500 characters or fewer.")
    .optional(),
});

export const cancelRiderPayoutInputSchema = z.object({
  payoutId: z.uuid("Rider payout selection is invalid."),
});

export type RiderPayoutListItemDto = {
  id: string;
  payoutCode: string;
  riderId: string;
  riderName: string;
  status: "in_progress" | "settled" | "void";
  deliveredWayCount: number;
  feePerWay: number;
  totalPayoutAmount: number;
  paidAt: string | null;
  paymentNote: string | null;
  createdAt: string;
};

const riderPayoutListSearchParamsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(1),
});

export type RiderPayoutListFiltersDto = {
  page: number;
  pageSize: number;
};

export type RiderPayoutListPageDto = {
  payouts: RiderPayoutListItemDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export const riderPayoutListPageSize = 20;

export function parseRiderPayoutListFilters(
  input: Record<string, string | string[] | undefined>,
): RiderPayoutListFiltersDto {
  const parseResult = riderPayoutListSearchParamsSchema.safeParse({
    page: readSearchParam(input.page),
  });

  return {
    page: parseResult.success ? (parseResult.data.page ?? 1) : 1,
    pageSize: riderPayoutListPageSize,
  };
}

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export type RiderPayoutEligibleFinancialItemDto = {
  id: string;
  parcelId: string | null;
  parcelCode: string | null;
  riderWaySource: RiderWaySource;
  status: "pending";
  createdAt: string;
};

export type RiderPayoutEligibleRiderDto = {
  riderId: string;
  riderName: string;
  eligibleItemCount: number;
  financialItems: RiderPayoutEligibleFinancialItemDto[];
};

export type RiderPayoutEligibleRiderSummaryDto = {
  riderId: string;
  riderName: string;
  eligibleItemCount: number;
};
