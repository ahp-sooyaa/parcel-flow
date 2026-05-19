import { describe, expect, test } from "bun:test";

import { createParcelFormInputSchema } from "@/features/parcels/server/dto";
import {
  calculateAmountToCollect,
  isActiveCollectionStatus,
  mapCreateParcelFormInputToCreateParcelInput,
} from "@/features/parcels/server/utils";

describe("parcel validation and mapping", () => {
  test("accepts boundary parcel values for non-cod parcels", () => {
    const result = createParcelFormInputSchema.safeParse({
      merchantId: "merchant-id",
      receiverName: "Receiver",
      receiverPhoneNumber: "09123",
      receiverAddress: "Address",
      specialNotes: "   ",
      townshipId: "township-id",
      deliveryFee: "0",
      hasCod: false,
      codAmount: "",
      dimensions: {
        estimatedWeight: "",
        width: "",
        height: "",
        length: "",
      },
    });

    expect(result.success).toBe(true);
  });

  test("rejects zero or empty COD amounts for cod parcels", () => {
    const emptyAmount = createParcelFormInputSchema.safeParse({
      merchantId: "merchant-id",
      receiverName: "Receiver",
      receiverPhoneNumber: "09123",
      receiverAddress: "Address",
      townshipId: "township-id",
      deliveryFee: "0",
      hasCod: true,
      codAmount: "",
      dimensions: {
        estimatedWeight: "",
        width: "",
        height: "",
        length: "",
      },
    });
    const zeroAmount = createParcelFormInputSchema.safeParse({
      merchantId: "merchant-id",
      receiverName: "Receiver",
      receiverPhoneNumber: "09123",
      receiverAddress: "Address",
      townshipId: "township-id",
      deliveryFee: "0",
      hasCod: true,
      codAmount: "0",
      dimensions: {
        estimatedWeight: "",
        width: "",
        height: "",
        length: "",
      },
    });

    expect(emptyAmount.success).toBe(false);
    expect(zeroAmount.success).toBe(false);
  });

  test("maps defaults, trims notes, and marks large parcels from dimensions", () => {
    const mapped = mapCreateParcelFormInputToCreateParcelInput({
      merchantId: "merchant-id",
      receiverName: "Receiver",
      receiverPhoneNumber: "09123456789",
      receiverAddress: "Address",
      specialNotes: "  Leave at gate  ",
      townshipId: "township-id",
      deliveryFee: "0",
      hasCod: false,
      codAmount: "",
      dimensions: {
        estimatedWeight: "",
        width: "12",
        height: "",
        length: "30",
      },
    });

    expect(mapped).toEqual({
      merchantId: "merchant-id",
      receiverName: "Receiver",
      receiverPhoneNumber: "09123456789",
      receiverAddress: "Address",
      specialNotes: "Leave at gate",
      townshipId: "township-id",
      parcelType: "non_cod",
      codAmount: 0,
      deliveryFee: 0,
      weightKg: 3,
      isLargeParcel: true,
      parcelWidthCm: 12,
      parcelLengthCm: 30,
    });
  });

  test("calculates collection totals by parcel type and active collection status", () => {
    expect(
      calculateAmountToCollect({ codAmount: 10_000, deliveryFee: 2_000, parcelType: "cod" }),
    ).toBe(12_000);
    expect(
      calculateAmountToCollect({ codAmount: 10_000, deliveryFee: 2_000, parcelType: "non_cod" }),
    ).toBe(2_000);
    expect(isActiveCollectionStatus("at_office")).toBe(true);
    expect(isActiveCollectionStatus("postpone")).toBe(true);
    expect(isActiveCollectionStatus("delivered")).toBe(false);
  });
});
