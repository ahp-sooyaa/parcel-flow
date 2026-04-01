import "server-only";

export type MerchantListItemDto = {
  id: string;
  name: string;
  phoneNumber: string | null;
  township: string;
  address: string;
  linkedAppUserId: string | null;
  linkedAppUserName: string | null;
  createdAt: Date;
};

export type MerchantDetailDto = {
  id: string;
  name: string;
  phoneNumber: string | null;
  township: string;
  address: string;
  notes: string | null;
  linkedAppUserId: string | null;
  linkedAppUserName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MerchantLinkableUserDto = {
  id: string;
  fullName: string;
  email: string;
};

export type CreateMerchantActionResult = {
  ok: boolean;
  message: string;
  merchantId?: string;
};

export function toMerchantListItemDto(input: MerchantListItemDto): MerchantListItemDto {
  return {
    id: input.id,
    name: input.name,
    phoneNumber: input.phoneNumber,
    township: input.township,
    address: input.address,
    linkedAppUserId: input.linkedAppUserId,
    linkedAppUserName: input.linkedAppUserName,
    createdAt: input.createdAt,
  };
}

export function toMerchantDetailDto(input: MerchantDetailDto): MerchantDetailDto {
  return {
    id: input.id,
    name: input.name,
    phoneNumber: input.phoneNumber,
    township: input.township,
    address: input.address,
    notes: input.notes,
    linkedAppUserId: input.linkedAppUserId,
    linkedAppUserName: input.linkedAppUserName,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}
