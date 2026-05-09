import type { SettlementListItemDto } from "@/features/settlements/server/dto";

const settlements: SettlementListItemDto[] = [
  {
    id: "settlement-1",
    settlementCode: "MS-20260509-001",
    merchantName: "North Star Mart",
    status: "in_progress",
    totalCodAmount: 300000,
    totalDeliveryFeeDeduction: 12000,
    netPaymentAmount: 288000,
    createdAt: "2026-05-09",
  },
];

export async function listSettlements() {
  return settlements;
}
