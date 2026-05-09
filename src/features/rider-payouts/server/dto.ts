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
