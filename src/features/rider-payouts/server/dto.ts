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
