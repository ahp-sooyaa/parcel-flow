export type SettlementListItemDto = {
  id: string;
  settlementCode: string;
  merchantName: string;
  status: "in_progress" | "settled" | "void";
  totalCodAmount: number;
  totalDeliveryFeeDeduction: number;
  netPaymentAmount: number;
  createdAt: string;
};
