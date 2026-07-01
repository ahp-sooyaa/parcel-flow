"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { DateFilterPopover } from "@/components/shared/date-filter-popover";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParcelDetailSheet } from "@/features/parcels/components/lazy-parcel-detail-sheet";
import { ParcelTable } from "@/features/parcels/components/parcel-table";
import type {
  MerchantParcelListFiltersDto,
  MerchantParcelListPageDto,
  MerchantParcelStatusFilter,
  ParcelListItemDto,
} from "@/features/parcels/server/dto";

const statusLabels: Record<MerchantParcelStatusFilter, string> = {
  all: "All",
  on_the_way: "On the way",
  delivered: "Delivered",
};

function isMerchantParcelStatusFilter(value: string): value is MerchantParcelStatusFilter {
  return value === "all" || value === "on_the_way" || value === "delivered";
}

export function MerchantParcelBrowser({
  result,
  filters,
}: Readonly<{
  result: MerchantParcelListPageDto;
  filters: MerchantParcelListFiltersDto;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(filters.searchTerm);
  const [viewingParcel, setViewingParcel] = useState<ParcelListItemDto | null>(null);

  useEffect(() => {
    setSearchTerm(filters.searchTerm);
  }, [filters.searchTerm]);

  function updateFilters(
    next: Partial<{
      query: string;
      date: string | null;
      status: MerchantParcelStatusFilter;
      page: number;
    }>,
  ) {
    const params = new URLSearchParams();
    const nextQuery = next.query ?? filters.searchTerm;
    const nextDate = next.date === undefined ? filters.createdOn : next.date;
    const nextStatus = next.status ?? filters.status;
    const nextPage = next.page ?? filters.page;

    if (nextQuery.trim()) {
      params.set("query", nextQuery.trim());
    }

    if (nextDate) {
      params.set("date", nextDate);
    }

    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={filters.status}
          onValueChange={(value) => {
            if (isMerchantParcelStatusFilter(value)) {
              updateFilters({ status: value, page: 1 });
            }
          }}
        >
          <TabsList className="rounded-lg border border-border bg-[#f3f2ef] p-1">
            {Object.entries(statusLabels).map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-md border-0 px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-foreground"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form
            className="w-full sm:w-[360px]"
            onSubmit={(event) => {
              event.preventDefault();
              updateFilters({ query: searchTerm, page: 1 });
            }}
          >
            <InputGroup className="rounded-lg border-border bg-white shadow-sm">
              <InputGroupAddon align="inline-start">
                <InputGroupText>
                  <Search className="size-4" />
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                value={searchTerm}
                placeholder="Search recipient name or phone number"
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </InputGroup>
          </form>
          <DateFilterPopover
            label="Filter date"
            value={filters.createdOn}
            onChange={(value) => updateFilters({ date: value, page: 1 })}
          />
          {filters.searchTerm || filters.createdOn || filters.status !== "all" ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => updateFilters({ query: "", date: null, status: "all", page: 1 })}
                className="rounded-lg border-border bg-white px-4 shadow-sm"
              >
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <ParcelTable
        parcels={result.parcels}
        onView={(parcel) => setViewingParcel(parcel)}
        showMerchantColumn={false}
        showRiderColumn={false}
      />

      <PaginationControls
        page={result.page}
        totalPages={result.totalPages}
        onPageChange={(page) => updateFilters({ page })}
      />

      <Sheet open={viewingParcel !== null} onOpenChange={(open) => !open && setViewingParcel(null)}>
        <SheetContent className="overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[720px] data-[side=right]:sm:max-w-[720px]">
          {viewingParcel ? <ParcelDetailSheet actorRole="merchant" parcel={viewingParcel} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
