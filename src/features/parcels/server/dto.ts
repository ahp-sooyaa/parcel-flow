import { z } from "zod";

import type { ParcelFailureNoteEntry } from "@/features/parcels/server/failure-notes";
import type { ParcelStatus, ParcelType } from "@/lib/domain";

function isNonNegativeIntegerString(value: string) {
  const numberValue = Number(value);

  return value.trim().length > 0 && Number.isInteger(numberValue) && numberValue >= 0;
}

function isOptionalPositiveNumberString(value: string) {
  if (value.trim().length === 0) {
    return true;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0;
}

const optionalPositiveNumberString = z
  .string()
  .trim()
  .refine(isOptionalPositiveNumberString, "Enter a number greater than 0.");

const parcelDimensionsInputSchema = z.object({
  estimatedWeight: optionalPositiveNumberString,
  width: optionalPositiveNumberString,
  height: optionalPositiveNumberString,
  length: optionalPositiveNumberString,
});

export const createParcelFormInputSchema = z
  .object({
    merchantId: z.string().min(1, "Merchant is required."),
    receiverName: z.string().trim().min(1, "Receiver name is required."),
    receiverPhoneNumber: z.string().trim().min(5, "Receiver phone number is required."),
    receiverAddress: z.string().trim().min(1, "Receiver address is required."),
    specialNotes: z.string().trim().optional(),
    townshipId: z.string().min(1, "Receiver township is required."),
    deliveryFee: z
      .string()
      .trim()
      .refine(isNonNegativeIntegerString, "Delivery fee must be 0 or greater."),
    hasCod: z.boolean(),
    codAmount: z
      .string()
      .trim()
      .refine(
        (value) => value.length === 0 || isNonNegativeIntegerString(value),
        "COD amount must be 0 or greater.",
      ),
    dimensions: parcelDimensionsInputSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.hasCod) {
      return;
    }

    if (!isNonNegativeIntegerString(value.codAmount) || Number(value.codAmount) <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "COD amount is required for COD parcels.",
        path: ["codAmount"],
      });
    }
  });

export type CreateParcelFormInputDto = z.infer<typeof createParcelFormInputSchema>;

export type CreateParcelInputDto = {
  merchantId: string;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverAddress: string;
  specialNotes?: string;
  townshipId: string;
  parcelType: ParcelType;
  codAmount: number;
  deliveryFee: number;
  weightKg: number;
  isLargeParcel: boolean;
  parcelWidthCm?: number;
  parcelHeightCm?: number;
  parcelLengthCm?: number;
};

export type ParcelListItemDto = {
  id: string;
  parcelCode: string;
  merchantName: string;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverAddress: string;
  specialNotes: string | null;
  failureNotes: ParcelFailureNoteEntry[];
  activeFailureNote: ParcelFailureNoteEntry | null;
  townshipName: string;
  codAmount: number;
  deliveryFee: number;
  proofOfDeliveryImagesKeys: string[];
  riderName: string | null;
  status: ParcelStatus;
  hasUnresolvedFailureReview: boolean;
  createdAt: string;
};

export type ParcelSummaryDto = {
  totalParcels: number;
  atOffice: number;
  onTheWay: number;
  delivered: number;
  expectedCollection: number;
};
