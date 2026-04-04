import "server-only";

export type MerchantListItemDto = {
  id: string;
  shopName: string;
  contactName: string;
  phoneNumber: string | null;
  townshipName: string | null;
  defaultPickupAddress: string | null;
  createdAt: Date;
};

export type MerchantDetailDto = {
  id: string;
  shopName: string;
  contactName: string;
  email: string;
  phoneNumber: string | null;
  pickupTownshipId: string | null;
  townshipName: string | null;
  defaultPickupAddress: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toMerchantListItemDto(input: MerchantListItemDto): MerchantListItemDto {
  return {
    id: input.id,
    shopName: input.shopName,
    contactName: input.contactName,
    phoneNumber: input.phoneNumber,
    townshipName: input.townshipName,
    defaultPickupAddress: input.defaultPickupAddress,
    createdAt: input.createdAt,
  };
}

export function toMerchantDetailDto(input: MerchantDetailDto): MerchantDetailDto {
  return {
    id: input.id,
    shopName: input.shopName,
    contactName: input.contactName,
    email: input.email,
    phoneNumber: input.phoneNumber,
    pickupTownshipId: input.pickupTownshipId,
    townshipName: input.townshipName,
    defaultPickupAddress: input.defaultPickupAddress,
    notes: input.notes,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}
