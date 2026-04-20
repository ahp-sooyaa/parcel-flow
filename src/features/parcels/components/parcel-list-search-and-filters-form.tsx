import {
    ListSearchAndFiltersForm,
    type ListFilterField,
} from "@/components/shared/list-search-and-filters-form";
import {
    COD_STATUSES,
    COLLECTION_STATUSES,
    DELIVERY_FEE_STATUSES,
    MERCHANT_SETTLEMENT_STATUSES,
    PARCEL_STATUSES,
    formatParcelStatusLabel,
    type ParcelStatusLabelValue,
} from "@/features/parcels/constants";

import type { ParcelListQuery } from "@/features/parcels/server/utils";

type ParcelListSearchAndFiltersFormProps = {
    query: ParcelListQuery;
    clearHref: string;
    includeInternalPaymentFilters?: boolean;
    className?: string;
};

function toStatusFilterOptions<TValue extends ParcelStatusLabelValue>(values: readonly TValue[]) {
    return values.map((value) => ({
        value,
        label: formatParcelStatusLabel(value),
    }));
}

function getParcelFilterFields(
    query: ParcelListQuery,
    includeInternalPaymentFilters: boolean,
): ListFilterField[] {
    return [
        {
            name: "parcelStatus",
            label: "Parcel Status",
            value: query.parcelStatus,
            allLabel: "All parcel statuses",
            options: toStatusFilterOptions(PARCEL_STATUSES),
        },
        {
            name: "codStatus",
            label: "COD Status",
            value: query.codStatus,
            allLabel: "All COD statuses",
            options: toStatusFilterOptions(COD_STATUSES),
        },
        ...(includeInternalPaymentFilters
            ? [
                  {
                      name: "collectionStatus",
                      label: "Collection Status",
                      value: query.collectionStatus,
                      allLabel: "All collection statuses",
                      options: toStatusFilterOptions(COLLECTION_STATUSES),
                  },
                  {
                      name: "deliveryFeeStatus",
                      label: "Delivery Fee Status",
                      value: query.deliveryFeeStatus,
                      allLabel: "All delivery fee statuses",
                      options: toStatusFilterOptions(DELIVERY_FEE_STATUSES),
                  },
              ]
            : []),
        {
            name: "merchantSettlementStatus",
            label: "Settlement",
            value: query.merchantSettlementStatus,
            allLabel: "All settlement statuses",
            options: toStatusFilterOptions(MERCHANT_SETTLEMENT_STATUSES),
        },
    ];
}

function getFormStateKey(query: ParcelListQuery, includeInternalPaymentFilters: boolean) {
    return JSON.stringify({
        q: query.query,
        parcelStatus: query.parcelStatus,
        codStatus: query.codStatus,
        collectionStatus: includeInternalPaymentFilters ? query.collectionStatus : null,
        deliveryFeeStatus: includeInternalPaymentFilters ? query.deliveryFeeStatus : null,
        merchantSettlementStatus: query.merchantSettlementStatus,
    });
}

export function ParcelListSearchAndFiltersForm({
    query,
    clearHref,
    includeInternalPaymentFilters = true,
    className,
}: Readonly<ParcelListSearchAndFiltersFormProps>) {
    return (
        <ListSearchAndFiltersForm
            key={getFormStateKey(query, includeInternalPaymentFilters)}
            searchValue={query.query}
            searchPlaceholder="Search by parcel code, recipient, phone or township"
            filters={getParcelFilterFields(query, includeInternalPaymentFilters)}
            clearHref={clearHref}
            submitLabel="Apply"
            className={className}
        />
    );
}
