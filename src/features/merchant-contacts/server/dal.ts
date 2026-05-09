import type { MerchantContactListItemDto } from "@/features/merchant-contacts/server/dto";

const contacts: MerchantContactListItemDto[] = [
  {
    id: "contact-1",
    merchantName: "North Star Mart",
    recipientName: "Aye Chan",
    recipientPhoneNumber: "09777111222",
    recipientAddress: "Sanchaung Street 21",
    townshipName: "Sanchaung",
  },
];

export async function listMerchantContacts() {
  return contacts;
}
