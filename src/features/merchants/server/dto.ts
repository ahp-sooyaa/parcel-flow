import { z } from "zod";

export const upsertMerchantInputSchema = z.object({
  userId: z.uuid().optional(),
  shopName: z.string().min(1),
  address: z.string().min(1),
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
