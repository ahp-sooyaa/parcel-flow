import { z } from "zod";

export const createRiderPayoutDraftInputSchema = z.object({
  riderId: z.uuid(),
  financialItemIds: z.array(z.uuid()).min(1),
  deliveredWayCount: z.coerce.number().int().min(1),
  feePerWay: z.coerce.number().int().min(1),
});

export type RiderPayoutListItemDto = {
  id: string;
  payoutCode: string;
  riderName: string;
  status: "in_progress" | "settled" | "void";
  deliveredWayCount: number;
  feePerWay: number;
  totalPayoutAmount: number;
  createdAt: string;
};
