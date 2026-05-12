import { z } from "zod";

import { calculateMerchantNetPayment } from "@/features/merchants/server/utils";

export const createSettlementDraftInputSchema = z
  .object({
    merchantId: z.uuid(),
    financialItemIds: z.array(z.uuid()).min(1),
    totalCodAmount: z.coerce.number().int().min(0),
    totalDeliveryFeeDeduction: z.coerce.number().int().min(0),
    bankAccountId: z.uuid().optional(),
  })
  .refine(
    (value) =>
      calculateMerchantNetPayment(value.totalCodAmount, value.totalDeliveryFeeDeduction) >= 0,
    "Delivery fee deductions exceed selected COD amount.",
  );

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
