import "server-only";
import type {
    BlockedMerchantSettlementCandidateDto,
    MerchantFinancialDirection,
    MerchantFinancialItemKind,
    MerchantSettlementSelectionDto,
    ReadyMerchantSettlementCandidateDto,
} from "./merchant-financial-item-dto";
import type {
    MERCHANT_SETTLEMENT_RECORD_STATUSES,
    MERCHANT_SETTLEMENT_TYPES,
} from "@/features/merchant-settlements/constants";
import type { ParcelImageAsset } from "@/features/parcels/server/utils";

export type MerchantSettlementStatus = (typeof MERCHANT_SETTLEMENT_RECORD_STATUSES)[number];
export type MerchantSettlementType = (typeof MERCHANT_SETTLEMENT_TYPES)[number];

export type {
    BlockedMerchantSettlementCandidateDto,
    MerchantFinancialDirection,
    MerchantFinancialItemKind,
    MerchantSettlementDirection,
    MerchantSettlementPreset,
    MerchantSettlementSelectionDto,
    ReadyMerchantSettlementCandidateDto,
} from "./merchant-financial-item-dto";

export type MerchantSettlementActorDto = {
    id: string;
    name: string;
};

export type MerchantSettlementTotalsDto = {
    creditsTotal: string;
    debitsTotal: string;
    netTotal: string;
};

export type MerchantSettlementListItemDto = {
    id: string;
    referenceNo: string | null;
    merchantId: string;
    merchantLabel: string;
    totalAmount: string;
    creditsTotal: string;
    debitsTotal: string;
    method: string;
    snapshotBankName: string | null;
    snapshotBankAccountNumber: string | null;
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
    merchantFinancialItemId: string | null;
    parcelId: string | null;
    parcelCode: string | null;
    recipientName: string | null;
    recipientTownshipName: string | null;
    candidateKind: MerchantFinancialItemKind;
    direction: MerchantFinancialDirection;
    snapshotAmount: string;
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

export type MerchantSettlementPickerDto = MerchantSettlementSelectionDto & {
    readyCandidates: ReadyMerchantSettlementCandidateDto[];
    blockedCandidates: BlockedMerchantSettlementCandidateDto[];
};
