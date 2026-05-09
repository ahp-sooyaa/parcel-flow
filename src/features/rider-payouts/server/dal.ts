import type { RiderPayoutListItemDto } from "@/features/rider-payouts/server/dto";

const payouts: RiderPayoutListItemDto[] = [
  {
    id: "payout-1",
    payoutCode: "RP-20260509-001",
    riderName: "Ma Ei",
    status: "in_progress",
    deliveredWayCount: 40,
    feePerWay: 900,
    totalPayoutAmount: 36000,
    createdAt: "2026-05-09",
  },
];

export async function listRiderPayouts() {
  return payouts;
}
