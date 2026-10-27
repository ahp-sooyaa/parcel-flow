import { z } from "zod";
import { maxLengthMessage, TEXT_LIMITS } from "@/lib/validation";

export const upsertMerchantInputSchema = z.object({
  userId: z.uuid().optional(),
  shopName: z
    .string()
    .min(1)
    .max(TEXT_LIMITS.shopName, maxLengthMessage("Shop name", TEXT_LIMITS.shopName)),
  address: z
    .string()
    .min(1)
    .max(TEXT_LIMITS.address, maxLengthMessage("Address", TEXT_LIMITS.address)),
});

export type MerchantListItemDto = {
  id: string;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  address: string;
  pendingPayment: number;
  parcelCount: number;
};

export type MerchantOptionDto = {
  id: string;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
};

export type MerchantOverviewSummaryDto = {
  totalCodCollected: number;
  paidToYou: number;
  totalParcels: number;
  onTheWayParcels: number;
  deliveredParcels: number;
};
