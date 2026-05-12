import { randomInt } from "node:crypto";

import type { CreateParcelFormInputDto, CreateParcelInputDto } from "@/features/parcels/server/dto";
import type { ParcelStatus } from "@/lib/domain";

function optionalNumberFromInput(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? Number(trimmedValue) : undefined;
}

export function mapCreateParcelFormInputToCreateParcelInput(
  input: CreateParcelFormInputDto,
): CreateParcelInputDto {
  const parcelWidthCm = optionalNumberFromInput(input.dimensions.width);
  const parcelHeightCm = optionalNumberFromInput(input.dimensions.height);
  const parcelLengthCm = optionalNumberFromInput(input.dimensions.length);
  const specialNotes = input.specialNotes?.trim();

  return {
    merchantId: input.merchantId,
    receiverName: input.receiverName,
    receiverPhoneNumber: input.receiverPhoneNumber,
    receiverAddress: input.receiverAddress,
    ...(specialNotes ? { specialNotes } : {}),
    townshipId: input.townshipId,
    parcelType: input.hasCod ? "cod" : "non_cod",
    codAmount: input.hasCod ? Number(input.codAmount) : 0,
    deliveryFee: Number(input.deliveryFee),
    weightKg: optionalNumberFromInput(input.dimensions.estimatedWeight) ?? 3,
    isLargeParcel:
      parcelWidthCm !== undefined || parcelHeightCm !== undefined || parcelLengthCm !== undefined,
    ...(parcelWidthCm !== undefined ? { parcelWidthCm } : {}),
    ...(parcelHeightCm !== undefined ? { parcelHeightCm } : {}),
    ...(parcelLengthCm !== undefined ? { parcelLengthCm } : {}),
  };
}

export function calculateAmountToCollect(parcel: {
  codAmount: number;
  deliveryFee: number;
  parcelType: string;
}) {
  if (parcel.parcelType === "cod") {
    return parcel.codAmount + parcel.deliveryFee;
  }

  return parcel.deliveryFee;
}

export function generateParcelCode() {
  const first = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const second = randomInt(0, 1_000_000).toString().padStart(6, "0");

  return `PF-${first}-${second}`;
}

export function isActiveCollectionStatus(status: ParcelStatus) {
  return status === "on_the_way" || status === "postpone";
}
