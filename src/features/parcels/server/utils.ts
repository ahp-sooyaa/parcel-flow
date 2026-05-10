import { randomInt } from "node:crypto";

import type { ParcelStatus } from "@/lib/domain";

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
