import "server-only";

export type RiderListItemDto = {
  id: string;
  riderCode: string;
  fullName: string;
  phoneNumber: string | null;
  township: string;
  address: string;
  linkedAppUserId: string | null;
  linkedAppUserName: string | null;
  createdAt: Date;
};

export type RiderLinkableUserDto = {
  id: string;
  fullName: string;
  email: string;
};

export type CreateRiderActionResult = {
  ok: boolean;
  message: string;
  riderId?: string;
};

export function toRiderListItemDto(input: RiderListItemDto): RiderListItemDto {
  return {
    id: input.id,
    riderCode: input.riderCode,
    fullName: input.fullName,
    phoneNumber: input.phoneNumber,
    township: input.township,
    address: input.address,
    linkedAppUserId: input.linkedAppUserId,
    linkedAppUserName: input.linkedAppUserName,
    createdAt: input.createdAt,
  };
}
