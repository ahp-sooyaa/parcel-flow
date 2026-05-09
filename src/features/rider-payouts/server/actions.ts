"use server";

import { z } from "zod";

import { calculateRiderPayout } from "@/features/riders/server/utils";

export const createRiderPayoutDraftSchema = z.object({
  riderId: z.string().uuid(),
  financialItemIds: z.array(z.string().uuid()).min(1),
  deliveredWayCount: z.coerce.number().int().min(1),
  feePerWay: z.coerce.number().int().min(1),
});

export async function createRiderPayoutDraftAction(input: unknown) {
  const payout = createRiderPayoutDraftSchema.parse(input);

  return {
    ok: true,
    payout: {
      ...payout,
      totalPayoutAmount: calculateRiderPayout(payout.deliveredWayCount, payout.feePerWay),
    },
  };
}
