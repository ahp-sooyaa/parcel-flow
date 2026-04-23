import "server-only";
import type {
    MERCHANT_SETTLEMENT_RECORD_STATUSES,
    MERCHANT_SETTLEMENT_TYPES,
} from "@/features/merchant-settlements/constants";
import type { DELIVERY_FEE_STATUSES } from "@/features/parcels/constants";
import type { ParcelImageAsset } from "@/features/parcels/server/utils";

export type MerchantSettlementStatus = (typeof MERCHANT_SETTLEMENT_RECORD_STATUSES)[number];
export type MerchantSettlementType = (typeof MERCHANT_SETTLEMENT_TYPES)[number];

export type EligibleMerchantSettlementParcelDto = {
    parcelId: string;
    parcelCode: string;
    paymentRecordId: string;
    recipientName: string;
    recipientTownshipName: string | null;
    codAmount: string;
    deliveryFee: string;
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
    isDeliveryFeeDeducted: boolean;
    netPayableAmount: string;
};

export type BlockedMerchantSettlementParcelDto = {
    parcelId: string;
    parcelCode: string;
    recipientName: string;
    recipientTownshipName: string | null;
    reasons: string[];
};

export type MerchantSettlementSelectionDto = {
    eligibleParcels: EligibleMerchantSettlementParcelDto[];
    blockedParcels: BlockedMerchantSettlementParcelDto[];
};

export type MerchantSettlementActorDto = {
    id: string;
    name: string;
};

export type MerchantSettlementTotalsDto = {
    codSubtotal: string;
    deliveryFeeDeductedTotal: string;
    netPayableTotal: string;
};

export type MerchantSettlementListItemDto = {
    id: string;
    referenceNo: string | null;
    merchantId: string;
    merchantLabel: string;
    totalAmount: string;
    method: string;
    snapshotBankName: string;
    snapshotBankAccountNumber: string;
    createdBy: string;
    createdByName: string;
    confirmedBy: string | null;
    confirmedByName: string | null;
    note: string | null;
    type: MerchantSettlementType;
    status: MerchantSettlementStatus;
    itemCount: number;
    createdAt: Date;
    updatedAt: Date;
};

export type MerchantSettlementHistoryDto = MerchantSettlementListItemDto & {
    paymentSlipImages: ParcelImageAsset[];
};

export type MerchantSettlementItemDto = {
    id: string;
    parcelId: string;
    parcelCode: string;
    recipientName: string;
    recipientTownshipName: string | null;
    snapshotCodAmount: string;
    snapshotDeliveryFee: string;
    isDeliveryFeeDeducted: boolean;
    netPayableAmount: string;
    createdAt: Date;
};

export type MerchantSettlementDetailDto = MerchantSettlementHistoryDto & {
    createdByActor: MerchantSettlementActorDto;
    confirmedByActor: MerchantSettlementActorDto | null;
    paymentSlipImageCount: number;
    totals: MerchantSettlementTotalsDto;
    items: MerchantSettlementItemDto[];
};

export type MerchantSettlementListQuery = {
    query: string;
    status: MerchantSettlementStatus | null;
    page: number;
    pageSize: number;
};

export type PaginatedMerchantSettlementListDto = {
    items: MerchantSettlementListItemDto[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
};

export type MerchantSettlementActionResult = {
    ok: boolean;
    message: string;
    settlementId?: string;
    fieldErrors?: Partial<Record<string, string[]>>;
};
