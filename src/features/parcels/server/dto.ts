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
    type ParcelImageAsset,
    type ParcelPaymentWriteValues,
    type ParcelWriteValues,
} from "./utils";

export type ParcelOptionDto = {
    id: string;
    label: string;
};

export type ParcelListItemDto = {
    id: string;
    parcelCode: string;
    merchantId: string;
    riderId: string | null;
    merchantLabel: string;
    recipientName: string;
    recipientTownshipName: string | null;
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
    collectionStatus: (typeof COLLECTION_STATUSES)[number];
    createdAt: Date;
};

export type RiderParcelActionDto = {
    label: string;
    nextStatus: (typeof PARCEL_STATUSES)[number];
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
    parcelDescription: string;
    packageCount: number;
    specialHandlingNote: string | null;
    estimatedWeightKg: string | null;
    packageWidthCm: string | null;
    packageHeightCm: string | null;
    packageLengthCm: string | null;
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
    pickupImages: ParcelImageAsset[];
    proofOfDeliveryImages: ParcelImageAsset[];
    paymentSlipImages: ParcelImageAsset[];
    createdAt: Date;
    updatedAt: Date;
};

export type RiderParcelDetailDto = {
    id: string;
    parcelCode: string;
    merchantLabel: string;
    riderLabel: string | null;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipName: string | null;
    recipientAddress: string;
    parcelDescription: string;
    packageCount: number;
    specialHandlingNote: string | null;
    estimatedWeightKg: string | null;
    packageWidthCm: string | null;
    packageHeightCm: string | null;
    packageLengthCm: string | null;
    parcelType: (typeof PARCEL_TYPES)[number];
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    codAmount: string;
    totalAmountToCollect: string;
    collectionStatus: (typeof COLLECTION_STATUSES)[number];
    pickupImages: ParcelImageAsset[];
    proofOfDeliveryImages: ParcelImageAsset[];
    nextAction: RiderParcelActionDto | null;
};

export type ParcelUpdateContextDto = {
    parcel: {
        id: string;
        parcelCode: string;
    } & ParcelWriteValues;
    payment: {
        id: string;
    } & ParcelPaymentWriteValues;
};

export type AuditLogInsertInput = {
    parcelId: string;
    updatedBy: string;
    sourceTable: "parcels" | "parcel_payment_records";
    event: string;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
};

export type CreateParcelInsertInput = ParcelWriteValues & {
    parcelCode: string;
};

export type CreatePaymentInsertInput = ParcelPaymentWriteValues;

export type ParcelUpdatePatch = Partial<ParcelWriteValues>;

export type ParcelPaymentUpdatePatch = Partial<ParcelPaymentWriteValues>;

export type ParcelFormFieldErrors = Partial<Record<string, string[]>>;

export type CreateParcelActionResult = {
    ok: boolean;
    message: string;
    parcelId?: string;
    fields?: Record<string, string>;
    fieldErrors?: ParcelFormFieldErrors;
};

export type UpdateParcelActionResult = {
    ok: boolean;
    message: string;
    fields?: Record<string, string>;
    fieldErrors?: ParcelFormFieldErrors;
};

export type RiderParcelImageUploadActionResult = {
    ok: boolean;
    message: string;
    fields?: Record<string, string>;
    fieldErrors?: ParcelFormFieldErrors;
};

export function toParcelListItemDto(input: {
    id: string;
    parcelCode: string;
    merchantId: string;
    riderId: string | null;
    merchantLabel: string;
    recipientName: string;
    recipientTownshipName: string | null;
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number] | null;
    collectionStatus: (typeof COLLECTION_STATUSES)[number] | null;
    createdAt: Date;
}): ParcelListItemDto {
    return {
        id: input.id,
        parcelCode: input.parcelCode,
        merchantId: input.merchantId,
        riderId: input.riderId,
        merchantLabel: input.merchantLabel,
        recipientName: input.recipientName,
        recipientTownshipName: input.recipientTownshipName,
        parcelStatus: input.parcelStatus,
        deliveryFeeStatus: input.deliveryFeeStatus ?? "unpaid",
        collectionStatus: input.collectionStatus ?? "pending",
        createdAt: input.createdAt,
    };
}

export function toMerchantParcelListItemDto(
    input: Parameters<typeof toParcelListItemDto>[0],
): ParcelListItemDto {
    return toParcelListItemDto(input);
}

export function toParcelDetailDto(input: {
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
    parcelDescription: string;
    packageCount: number;
    specialHandlingNote: string | null;
    estimatedWeightKg: string | null;
    packageWidthCm: string | null;
    packageHeightCm: string | null;
    packageLengthCm: string | null;
    parcelType: (typeof PARCEL_TYPES)[number];
    codAmount: string;
    deliveryFee: string;
    totalAmountToCollect: string;
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number] | null;
    codStatus: (typeof COD_STATUSES)[number] | null;
    collectedAmount: string | null;
    collectionStatus: (typeof COLLECTION_STATUSES)[number] | null;
    merchantSettlementStatus: (typeof MERCHANT_SETTLEMENT_STATUSES)[number] | null;
    riderPayoutStatus: (typeof RIDER_PAYOUT_STATUSES)[number] | null;
    paymentNote: string | null;
    pickupImages?: ParcelImageAsset[];
    proofOfDeliveryImages?: ParcelImageAsset[];
    paymentSlipImages?: ParcelImageAsset[];
    createdAt: Date;
    updatedAt: Date;
}): ParcelDetailDto {
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
        parcelDescription: input.parcelDescription,
        packageCount: input.packageCount,
        specialHandlingNote: input.specialHandlingNote,
        estimatedWeightKg: input.estimatedWeightKg,
        packageWidthCm: input.packageWidthCm,
        packageHeightCm: input.packageHeightCm,
        packageLengthCm: input.packageLengthCm,
        parcelType: input.parcelType,
        codAmount: input.codAmount,
        deliveryFee: input.deliveryFee,
        totalAmountToCollect: input.totalAmountToCollect,
        deliveryFeePayer: input.deliveryFeePayer,
        parcelStatus: input.parcelStatus,
        deliveryFeeStatus: input.deliveryFeeStatus ?? "unpaid",
        codStatus: input.codStatus ?? "pending",
        collectedAmount: input.collectedAmount ?? "0",
        collectionStatus: input.collectionStatus ?? "pending",
        merchantSettlementStatus: input.merchantSettlementStatus ?? "pending",
        riderPayoutStatus: input.riderPayoutStatus ?? "pending",
        paymentNote: input.paymentNote,
        pickupImages: input.pickupImages ?? [],
        proofOfDeliveryImages: input.proofOfDeliveryImages ?? [],
        paymentSlipImages: input.paymentSlipImages ?? [],
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
    };
}

export function toRiderParcelDetailDto(
    input: Pick<
        ParcelDetailDto,
        | "id"
        | "parcelCode"
        | "merchantLabel"
        | "riderLabel"
        | "recipientName"
        | "recipientPhone"
        | "recipientTownshipName"
        | "recipientAddress"
        | "parcelDescription"
        | "packageCount"
        | "specialHandlingNote"
        | "estimatedWeightKg"
        | "packageWidthCm"
        | "packageHeightCm"
        | "packageLengthCm"
        | "parcelType"
        | "parcelStatus"
        | "codAmount"
        | "totalAmountToCollect"
        | "collectionStatus"
        | "pickupImages"
        | "proofOfDeliveryImages"
    > & {
        nextAction: RiderParcelActionDto | null;
    },
): RiderParcelDetailDto {
    return {
        id: input.id,
        parcelCode: input.parcelCode,
        merchantLabel: input.merchantLabel,
        riderLabel: input.riderLabel,
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        recipientTownshipName: input.recipientTownshipName,
        recipientAddress: input.recipientAddress,
        parcelDescription: input.parcelDescription,
        packageCount: input.packageCount,
        specialHandlingNote: input.specialHandlingNote,
        estimatedWeightKg: input.estimatedWeightKg,
        packageWidthCm: input.packageWidthCm,
        packageHeightCm: input.packageHeightCm,
        packageLengthCm: input.packageLengthCm,
        parcelType: input.parcelType,
        parcelStatus: input.parcelStatus,
        codAmount: input.codAmount,
        totalAmountToCollect: input.totalAmountToCollect,
        collectionStatus: input.collectionStatus,
        pickupImages: input.pickupImages,
        proofOfDeliveryImages: input.proofOfDeliveryImages,
        nextAction: input.nextAction,
    };
}

export function toParcelUpdateContextDto(input: {
    parcelId: string;
    parcelCode: string;
    merchantId: string;
    riderId: string | null;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
    parcelDescription: string;
    packageCount: number;
    specialHandlingNote: string | null;
    estimatedWeightKg: string | null;
    packageWidthCm: string | null;
    packageHeightCm: string | null;
    packageLengthCm: string | null;
    pickupImageKeys: string[] | null;
    proofOfDeliveryImageKeys: string[] | null;
    parcelType: (typeof PARCEL_TYPES)[number];
    codAmount: string;
    deliveryFee: string;
    totalAmountToCollect: string;
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    paymentId: string | null;
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number] | null;
    codStatus: (typeof COD_STATUSES)[number] | null;
    collectedAmount: string | null;
    collectionStatus: (typeof COLLECTION_STATUSES)[number] | null;
    merchantSettlementStatus: (typeof MERCHANT_SETTLEMENT_STATUSES)[number] | null;
    riderPayoutStatus: (typeof RIDER_PAYOUT_STATUSES)[number] | null;
    paymentNote: string | null;
    paymentSlipImageKeys: string[] | null;
}): ParcelUpdateContextDto {
    return {
        parcel: {
            id: input.parcelId,
            parcelCode: input.parcelCode,
            merchantId: input.merchantId,
            riderId: input.riderId,
            recipientName: input.recipientName,
            recipientPhone: input.recipientPhone,
            recipientTownshipId: input.recipientTownshipId,
            recipientAddress: input.recipientAddress,
            parcelDescription: input.parcelDescription,
            packageCount: input.packageCount,
            specialHandlingNote: input.specialHandlingNote,
            estimatedWeightKg: input.estimatedWeightKg,
            packageWidthCm: input.packageWidthCm,
            packageHeightCm: input.packageHeightCm,
            packageLengthCm: input.packageLengthCm,
            parcelType: input.parcelType,
            codAmount: input.codAmount,
            deliveryFee: input.deliveryFee,
            totalAmountToCollect: input.totalAmountToCollect,
            deliveryFeePayer: input.deliveryFeePayer,
            pickupImageKeys: input.pickupImageKeys ?? [],
            proofOfDeliveryImageKeys: input.proofOfDeliveryImageKeys ?? [],
            status: input.parcelStatus,
        },
        payment: {
            id: input.paymentId!,
            deliveryFeeStatus: input.deliveryFeeStatus ?? "unpaid",
            codStatus: input.codStatus ?? "pending",
            collectedAmount: input.collectedAmount ?? "0",
            collectionStatus: input.collectionStatus ?? "pending",
            merchantSettlementStatus: input.merchantSettlementStatus ?? "pending",
            riderPayoutStatus: input.riderPayoutStatus ?? "pending",
            note: input.paymentNote,
            paymentSlipImageKeys: input.paymentSlipImageKeys ?? [],
        },
    };
}
