"use server";

import { z } from "zod";

import { calculateMerchantNetPayment } from "@/features/merchants/server/utils";

export const createSettlementDraftSchema = z
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

export async function createSettlementDraftAction(input: unknown) {
  return {
    ok: true,
    settlement: createSettlementDraftSchema.parse(input),
  };
}
