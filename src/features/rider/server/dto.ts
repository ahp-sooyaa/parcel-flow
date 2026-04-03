import "server-only";

export type RiderListItemDto = {
  id: string;
  fullName: string;
  phoneNumber: string | null;
  townshipName: string | null;
  vehicleType: string;
  licensePlate: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
};

export type RiderDetailDto = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  townshipName: string | null;
  vehicleType: string;
  licensePlate: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toRiderListItemDto(input: RiderListItemDto): RiderListItemDto {
  return {
    id: input.id,
    fullName: input.fullName,
    phoneNumber: input.phoneNumber,
    townshipName: input.townshipName,
    vehicleType: input.vehicleType,
    licensePlate: input.licensePlate,
    isActive: input.isActive,
    notes: input.notes,
    createdAt: input.createdAt,
  };
}

export function toRiderDetailDto(input: RiderDetailDto): RiderDetailDto {
  return {
    id: input.id,
    fullName: input.fullName,
    email: input.email,
    phoneNumber: input.phoneNumber,
    townshipName: input.townshipName,
    vehicleType: input.vehicleType,
    licensePlate: input.licensePlate,
    isActive: input.isActive,
    notes: input.notes,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}
