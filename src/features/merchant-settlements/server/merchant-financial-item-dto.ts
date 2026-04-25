import "server-only";
import type {
    MERCHANT_FINANCIAL_DIRECTIONS,
    MERCHANT_FINANCIAL_ITEM_KINDS,
    MERCHANT_FINANCIAL_LIFECYCLE_STATES,
    MERCHANT_FINANCIAL_READINESS_STATES,
    MERCHANT_SETTLEMENT_PRESETS,
    MERCHANT_SETTLEMENT_TYPES,
} from "@/features/merchant-settlements/constants";
import type {
    COLLECTION_STATUSES,
    COD_STATUSES,
    DELIVERY_FEE_PAYERS,
    DELIVERY_FEE_PAYMENT_PLANS,
    DELIVERY_FEE_STATUSES,
    MERCHANT_SETTLEMENT_STATUSES,
    PARCEL_STATUSES,
    PARCEL_TYPES,
} from "@/features/parcels/constants";

export type MerchantFinancialItemKind = (typeof MERCHANT_FINANCIAL_ITEM_KINDS)[number];
export type MerchantFinancialDirection = (typeof MERCHANT_FINANCIAL_DIRECTIONS)[number];
export type MerchantFinancialReadinessState = (typeof MERCHANT_FINANCIAL_READINESS_STATES)[number];
export type MerchantFinancialLifecycleState = (typeof MERCHANT_FINANCIAL_LIFECYCLE_STATES)[number];
export type MerchantSettlementPreset = (typeof MERCHANT_SETTLEMENT_PRESETS)[number];
export type MerchantSettlementDirection = (typeof MERCHANT_SETTLEMENT_TYPES)[number];

export type MerchantFinancialItemDerivationInput = {
    merchantId: string;
    parcelId: string;
    paymentRecordId: string;
    parcelCode: string;
    recipientName: string;
    recipientTownshipName: string | null;
    parcelType: (typeof PARCEL_TYPES)[number];
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
    deliveryFee: string;
    codAmount: string;
    codStatus: (typeof COD_STATUSES)[number];
    collectionStatus: (typeof COLLECTION_STATUSES)[number];
    merchantSettlementStatus: (typeof MERCHANT_SETTLEMENT_STATUSES)[number];
    merchantSettlementId: string | null;
    paymentSlipImageKeyCount: number;
};

export type MerchantFinancialItemDraft = {
    sourceObligationKey: string;
    merchantId: string;
    sourceParcelId: string;
    sourcePaymentRecordId: string;
    kind: MerchantFinancialItemKind;
    direction: MerchantFinancialDirection;
    amount: string;
    readiness: MerchantFinancialReadinessState;
    blockedReasons: string[];
};

export type MerchantSettlementCandidateDto = {
    id: string;
    merchantId: string;
    parcelId: string | null;
    paymentRecordId: string | null;
    parcelCode: string | null;
    recipientName: string | null;
    recipientTownshipName: string | null;
    parcelStatus: (typeof PARCEL_STATUSES)[number] | null;
    kind: MerchantFinancialItemKind;
    direction: MerchantFinancialDirection;
    amount: string;
    codAmount: string | null;
    deliveryFee: string | null;
    isDeliveryFeeDeducted: boolean;
    blockedReasons: string[];
    note: string | null;
};

export type ReadyMerchantSettlementCandidateDto = MerchantSettlementCandidateDto & {
    blockedReasons: [];
};

export type BlockedMerchantSettlementCandidateDto = MerchantSettlementCandidateDto;

export type MerchantSettlementSelectionSummaryDto = {
    selectedCount: number;
    creditsTotal: string;
    debitsTotal: string;
    netTotal: string;
    direction: MerchantSettlementDirection;
};

export type MerchantSettlementSelectionDto = {
    readyCandidates: ReadyMerchantSettlementCandidateDto[];
    blockedCandidates: BlockedMerchantSettlementCandidateDto[];
};
