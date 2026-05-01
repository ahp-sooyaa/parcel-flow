"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    COD_STATUSES,
    COLLECTION_STATUSES,
    DELIVERY_FEE_STATUSES,
    MERCHANT_SETTLEMENT_STATUSES,
    PARCEL_STATUSES,
    formatParcelStatusLabel,
    type ParcelStatusLabelValue,
} from "@/features/parcels/constants";
import { cn } from "@/lib/utils";

import type { ParcelListQuery } from "@/features/parcels/server/utils";

type ParcelListSearchAndFiltersFormProps = {
    query: ParcelListQuery;
    clearHref: string;
    includeInternalPaymentFilters?: boolean;
    className?: string;
};

type FilterField = {
    name: string;
    label: string;
    value: readonly string[];
    options: ReadonlyArray<{
        value: string;
        label: string;
    }>;
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
): FilterField[] {
    return [
        {
            name: "parcelStatus",
            label: "Parcel Status",
            value: query.parcelStatus,
            options: toStatusFilterOptions(PARCEL_STATUSES),
        },
        {
            name: "codStatus",
            label: "COD Status",
            value: query.codStatus,
            options: toStatusFilterOptions(COD_STATUSES),
        },
        ...(includeInternalPaymentFilters
            ? [
                  {
                      name: "collectionStatus",
                      label: "Collection Status",
                      value: query.collectionStatus,
                      options: toStatusFilterOptions(COLLECTION_STATUSES),
                  },
                  {
                      name: "deliveryFeeStatus",
                      label: "Delivery Fee Status",
                      value: query.deliveryFeeStatus,
                      options: toStatusFilterOptions(DELIVERY_FEE_STATUSES),
                  },
              ]
            : []),
        {
            name: "merchantSettlementStatus",
            label: "Settlement",
            value: query.merchantSettlementStatus,
            options: toStatusFilterOptions(MERCHANT_SETTLEMENT_STATUSES),
        },
    ];
}

function getActiveFilterSummary(
    query: ParcelListQuery,
    filters: readonly FilterField[],
    includeInternalPaymentFilters: boolean,
) {
    const activeFilters = filters
        .filter((filter) => Boolean(filter.value))
        .filter((filter) => filter.value.length > 0)
        .map((filter) => filter.label);

    if (query.query) {
        activeFilters.unshift("Search");
    }

    if (query.riderAssignment !== "all") {
        activeFilters.push("Rider Assignment");
    }

    const hasActiveFilters =
        query.query.length > 0 ||
        query.riderAssignment !== "all" ||
        query.parcelStatus.length > 0 ||
        query.codStatus.length > 0 ||
        (includeInternalPaymentFilters &&
            (query.collectionStatus.length > 0 || query.deliveryFeeStatus.length > 0)) ||
        query.merchantSettlementStatus.length > 0;

    return {
        activeFilters,
        hasActiveFilters,
    };
}

export function ParcelListSearchAndFiltersForm({
    query,
    clearHref,
    includeInternalPaymentFilters = true,
    className,
}: Readonly<ParcelListSearchAndFiltersFormProps>) {
    const filters = getParcelFilterFields(query, includeInternalPaymentFilters);
    const { activeFilters, hasActiveFilters } = getActiveFilterSummary(
        query,
        filters,
        includeInternalPaymentFilters,
    );

    return (
        <div
            className={cn(
                "flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between",
                className,
            )}
        >
            <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">Search and Filters</p>
                <p className="truncate text-sm text-muted-foreground">
                    {hasActiveFilters
                        ? `${activeFilters.length} filter${activeFilters.length === 1 ? "" : "s"} applied`
                        : "No filters applied"}
                </p>
            </div>

            <div className="flex items-center gap-2">
                {hasActiveFilters ? (
                    <Button asChild size="sm" variant="outline">
                        <Link href={clearHref}>Clear</Link>
                    </Button>
                ) : null}

                <Sheet>
                    <SheetTrigger asChild>
                        <Button size="sm" variant="outline">
                            <SlidersHorizontalIcon />
                            Filters
                        </Button>
                    </SheetTrigger>

                    <SheetContent
                        side="bottom"
                        className="max-h-[85vh] rounded-t-2xl border-x-0 border-b-0"
                    >
                        <form
                            action={clearHref}
                            className="flex h-full flex-col gap-0"
                            method="get"
                        >
                            <SheetHeader className="pr-8">
                                <SheetTitle>Filters</SheetTitle>
                                <SheetDescription>
                                    Search parcels and narrow the list with status filters.
                                </SheetDescription>
                            </SheetHeader>

                            <div className="flex-1 space-y-6 overflow-y-auto py-6">
                                <input
                                    type="hidden"
                                    name="riderAssignment"
                                    value={query.riderAssignment}
                                />
                                <div className="space-y-2">
                                    <Label htmlFor="parcel-list-search">Search</Label>
                                    <Input
                                        id="parcel-list-search"
                                        name="q"
                                        defaultValue={query.query}
                                        placeholder="Search by parcel code, recipient, phone or township"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    {filters.map((filter) => (
                                        <div key={filter.name} className="space-y-2">
                                            <div className="space-y-1">
                                                <Label>{filter.label}</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Select one or more options.
                                                </p>
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {filter.options.map((option) => (
                                                    <label
                                                        key={option.value}
                                                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            name={filter.name}
                                                            value={option.value}
                                                            defaultChecked={filter.value.includes(
                                                                option.value,
                                                            )}
                                                            className="size-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
                                                        />
                                                        <span>{option.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <SheetFooter className="mt-auto border-t pt-4">
                                <Button asChild type="button" variant="outline">
                                    <Link href={clearHref}>Reset</Link>
                                </Button>
                                <SheetClose asChild>
                                    <Button type="submit">Apply Filters</Button>
                                </SheetClose>
                            </SheetFooter>
                        </form>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
    );
}
