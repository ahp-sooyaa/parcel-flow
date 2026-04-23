import {
    ListSearchAndFiltersForm,
    type ListFilterField,
} from "@/components/shared/list-search-and-filters-form";
import { MERCHANT_SETTLEMENT_RECORD_STATUSES } from "@/features/merchant-settlements/constants";

import type { MerchantSettlementListQuery } from "@/features/merchant-settlements/server/dto";

type MerchantSettlementListSearchAndFiltersFormProps = {
    query: MerchantSettlementListQuery;
    clearHref: string;
};

function formatLabel(value: string) {
    return value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function getFilterFields(query: MerchantSettlementListQuery): ListFilterField[] {
    return [
        {
            name: "status",
            label: "Status",
            value: query.status,
            allLabel: "All statuses",
            options: MERCHANT_SETTLEMENT_RECORD_STATUSES.map((status) => ({
                value: status,
                label: formatLabel(status),
            })),
        },
    ];
}

export function MerchantSettlementListSearchAndFiltersForm({
    query,
    clearHref,
}: Readonly<MerchantSettlementListSearchAndFiltersFormProps>) {
    return (
        <ListSearchAndFiltersForm
            key={JSON.stringify({
                q: query.query,
                status: query.status,
            })}
            searchValue={query.query}
            searchPlaceholder="Search by settlement id, reference or merchant"
            filters={getFilterFields(query)}
            clearHref={clearHref}
            submitLabel="Apply"
        />
    );
}
