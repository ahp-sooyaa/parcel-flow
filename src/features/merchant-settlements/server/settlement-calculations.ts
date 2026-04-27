import { toSettlementMoneyString } from "./merchant-financial-item-utils";

import type {
    COLLECTION_STATUSES,
    DELIVERY_FEE_PAYERS,
    DELIVERY_FEE_STATUSES,
    MERCHANT_SETTLEMENT_STATUSES,
    PARCEL_STATUSES,
} from "../../parcels/constants";
import type { MerchantSettlementItemDto, MerchantSettlementTotalsDto } from "./dto";

export function calculateSettlementItemAmounts(input: {
    codAmount: string;
    deliveryFee: string;
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
}) {
    const codAmount = Number(input.codAmount);
    const deliveryFee = Number(input.deliveryFee);
    const isDeliveryFeeDeducted = input.deliveryFeeStatus === "deduct_from_settlement";
    const netPayableAmount = isDeliveryFeeDeducted ? codAmount - deliveryFee : codAmount;

    return {
        snapshotCodAmount: toSettlementMoneyString(codAmount),
        snapshotDeliveryFee: toSettlementMoneyString(deliveryFee),
        isDeliveryFeeDeducted,
        snapshotAmount: toSettlementMoneyString(netPayableAmount),
        netPayableAmount: toSettlementMoneyString(netPayableAmount),
    };
}

export function calculateSettlementTotals(
    items: readonly Pick<
        MerchantSettlementItemDto,
        "direction" | "snapshotAmount" | "netPayableAmount"
    >[],
): MerchantSettlementTotalsDto {
    const totals = items.reduce(
        (summary, item) => {
            const amount =
                item.snapshotAmount && Number.isFinite(Number(item.snapshotAmount))
                    ? Number(item.snapshotAmount)
                    : Math.abs(Number(item.netPayableAmount));

            if (item.direction === "company_owes_merchant") {
                summary.creditsTotal += amount;
            } else {
                summary.debitsTotal += amount;
            }

            return summary;
        },
        {
            creditsTotal: 0,
            debitsTotal: 0,
        },
    );

    return {
        creditsTotal: toSettlementMoneyString(totals.creditsTotal),
        debitsTotal: toSettlementMoneyString(totals.debitsTotal),
        netTotal: toSettlementMoneyString(totals.creditsTotal - totals.debitsTotal),
    };
}

export function isMerchantPaidDeliveryFeeUnresolved(input: {
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
}) {
    return input.deliveryFeePayer === "merchant" && input.deliveryFeeStatus === "unpaid";
}

export function getMerchantSettlementBlockedReasons(input: {
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    codStatus: "not_applicable" | "pending" | "collected" | "not_collected";
    codAmount: string;
    deliveryFee: string;
    collectionStatus: (typeof COLLECTION_STATUSES)[number];
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
    merchantSettlementStatus: (typeof MERCHANT_SETTLEMENT_STATUSES)[number];
    merchantSettlementId: string | null;
}) {
    const reasons: string[] = [];

    if (input.parcelStatus !== "delivered") {
        reasons.push("Parcel is not delivered.");
    }

    if (input.codStatus !== "collected") {
        reasons.push("COD not collected.");
    }

    if (input.collectionStatus !== "received_by_office") {
        reasons.push("COD not received by office.");
    }

    if (isMerchantPaidDeliveryFeeUnresolved(input)) {
        reasons.push("Delivery fee is unresolved.");
    }

    if (
        input.deliveryFeeStatus === "deduct_from_settlement" &&
        (input.deliveryFeePayer !== "merchant" ||
            Number(input.deliveryFee) <= 0 ||
            Number(input.codAmount) <= Number(input.deliveryFee))
    ) {
        reasons.push("Delivery fee deduction is invalid.");
    }

    if (input.merchantSettlementStatus === "settled") {
        reasons.push("Parcel is already settled.");
    } else if (input.merchantSettlementStatus !== "pending" || input.merchantSettlementId) {
        reasons.push("Parcel is already locked by a settlement.");
    }

    return reasons;
}
