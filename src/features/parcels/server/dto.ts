import "server-only";
import {
  COD_STATUSES,
  COLLECTION_STATUSES,
  DELIVERY_FEE_PAYERS,
  DELIVERY_FEE_STATUSES,
  MERCHANT_SETTLEMENT_STATUSES,
  PARCEL_STATUSES,
  PARCEL_TYPES,
  RIDER_PAYOUT_STATUSES,
} from "./utils";

export type ParcelOptionDto = {
  id: string;
  label: string;
};

export type ParcelListItemDto = {
  id: string;
  parcelCode: string;
  merchantLabel: string;
  recipientName: string;
  recipientTownshipName: string | null;
  parcelStatus: (typeof PARCEL_STATUSES)[number];
  deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
  collectionStatus: (typeof COLLECTION_STATUSES)[number];
  createdAt: Date;
};

export type ParcelDetailDto = {
  id: string;
  parcelCode: string;
  merchantId: string;
  merchantLabel: string;
  riderId: string | null;
  riderLabel: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientTownshipId: string;
  recipientTownshipName: string | null;
  recipientAddress: string;
  parcelType: (typeof PARCEL_TYPES)[number];
  codAmount: string;
  deliveryFee: string;
  totalAmountToCollect: string;
  deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
  parcelStatus: (typeof PARCEL_STATUSES)[number];
  deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
  codStatus: (typeof COD_STATUSES)[number];
  collectedAmount: string;
  collectionStatus: (typeof COLLECTION_STATUSES)[number];
  merchantSettlementStatus: (typeof MERCHANT_SETTLEMENT_STATUSES)[number];
  riderPayoutStatus: (typeof RIDER_PAYOUT_STATUSES)[number];
  paymentNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateParcelActionResult = {
  ok: boolean;
  message: string;
  parcelId?: string;
  fields?: CreateParcelFormFields;
};

export type UpdateParcelActionResult = {
  ok: boolean;
  message: string;
  fields?: UpdateParcelFormFields;
};

export type CreateParcelFormFields = {
  merchantId: string;
  riderId: string;
  recipientName: string;
  recipientPhone: string;
  recipientTownshipId: string;
  recipientAddress: string;
  parcelType: string;
  codAmount: string;
  deliveryFee: string;
  deliveryFeePayer: string;
  deliveryFeeStatus: string;
  paymentNote: string;
};

export type UpdateParcelFormFields = {
  parcelId: string;
  merchantId: string;
  riderId: string;
  recipientName: string;
  recipientPhone: string;
  recipientTownshipId: string;
  recipientAddress: string;
  parcelType: string;
  codAmount: string;
  deliveryFee: string;
  deliveryFeePayer: string;
  parcelStatus: string;
  deliveryFeeStatus: string;
  codStatus: string;
  collectedAmount: string;
  collectionStatus: string;
  merchantSettlementStatus: string;
  riderPayoutStatus: string;
  paymentNote: string;
};

export function toParcelListItemDto(input: ParcelListItemDto): ParcelListItemDto {
  return {
    id: input.id,
    parcelCode: input.parcelCode,
    merchantLabel: input.merchantLabel,
    recipientName: input.recipientName,
    recipientTownshipName: input.recipientTownshipName,
    parcelStatus: input.parcelStatus,
    deliveryFeeStatus: input.deliveryFeeStatus,
    collectionStatus: input.collectionStatus,
    createdAt: input.createdAt,
  };
}

export function toParcelDetailDto(input: ParcelDetailDto): ParcelDetailDto {
  return {
    id: input.id,
    parcelCode: input.parcelCode,
    merchantId: input.merchantId,
    merchantLabel: input.merchantLabel,
    riderId: input.riderId,
    riderLabel: input.riderLabel,
    recipientName: input.recipientName,
    recipientPhone: input.recipientPhone,
    recipientTownshipId: input.recipientTownshipId,
    recipientTownshipName: input.recipientTownshipName,
    recipientAddress: input.recipientAddress,
    parcelType: input.parcelType,
    codAmount: input.codAmount,
    deliveryFee: input.deliveryFee,
    totalAmountToCollect: input.totalAmountToCollect,
    deliveryFeePayer: input.deliveryFeePayer,
    parcelStatus: input.parcelStatus,
    deliveryFeeStatus: input.deliveryFeeStatus,
    codStatus: input.codStatus,
    collectedAmount: input.collectedAmount,
    collectionStatus: input.collectionStatus,
    merchantSettlementStatus: input.merchantSettlementStatus,
    riderPayoutStatus: input.riderPayoutStatus,
    paymentNote: input.paymentNote,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}
