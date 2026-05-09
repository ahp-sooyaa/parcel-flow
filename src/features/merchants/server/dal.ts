import type { MerchantListItemDto } from "@/features/merchants/server/dto";

const merchants: MerchantListItemDto[] = [
  {
    id: "merchant-1",
    shopName: "North Star Mart",
    ownerName: "Daw Hnin",
    phoneNumber: "09900111222",
    address: "Sanchaung Township",
    pendingPayment: 85000,
    parcelCount: 18,
  },
  {
    id: "merchant-2",
    shopName: "Ruby Home Store",
    ownerName: "Ko Zaw",
    phoneNumber: "09777111000",
    address: "Hlaing Township",
    pendingPayment: 0,
    parcelCount: 9,
  },
];

export async function listMerchants() {
  return merchants;
}
