"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Route, Search, SlidersHorizontal } from "lucide-react";

import { PaginationControls } from "@/components/shared/pagination-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssignRiderDialog } from "@/features/parcels/components/assign-rider-dialog";
import { EditParcelForm } from "@/features/parcels/components/edit-parcel-form";
import { ParcelDetailSheet } from "@/features/parcels/components/lazy-parcel-detail-sheet";
import { ParcelTable } from "@/features/parcels/components/parcel-table";
import type { MerchantOptionDto } from "@/features/merchants/server/dto";
import { getAdminParcelDetailAction } from "@/features/parcels/server/actions";
import type {
  AdminParcelAssignmentFilter,
  AdminParcelListFiltersDto,
  AdminParcelListPageDto,
  ParcelListItemDto,
} from "@/features/parcels/server/dto";
import type { RiderOptionDto } from "@/features/riders/server/dto";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { parcelStatusLabels, parcelStatuses, type ParcelStatus, type UserRole } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type TownshipOption = { value: string; label: string };

const assignmentFilterLabels: Record<AdminParcelAssignmentFilter, string> = {
  all: "All",
  unassigned: "Unassigned",
  assigned: "Assigned",
  need_review: "Need review",
};

const assignmentFilters = ["all", "unassigned", "assigned", "need_review"] as const;

function isAssignmentFilter(value: string): value is AdminParcelAssignmentFilter {
  return (
    value === "all" || value === "unassigned" || value === "assigned" || value === "need_review"
  );
}

export function ParcelListView({
  actorRole,
  pageResult,
  filters,
  merchants,
  riders,
  townships,
}: Readonly<{
  actorRole: UserRole;
  pageResult: AdminParcelListPageDto;
  filters: AdminParcelListFiltersDto;
  merchants: MerchantOptionDto[];
  riders: RiderOptionDto[];
  townships: TownshipListItemDto[];
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(filters.searchTerm);
  const [selectedStatuses, setSelectedStatuses] = useState<ParcelStatus[]>(filters.statuses);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([]);
  const [editingParcel, setEditingParcel] = useState<ParcelListItemDto | null>(null);
  const [viewingParcel, setViewingParcel] = useState<ParcelListItemDto | null>(null);
  const [, startParcelDetailTransition] = useTransition();
  const parcels = pageResult.parcels;
  const filterRef = useRef<HTMLDivElement>(null);
  const townshipInputId = useId();
  const selectedTownship = filters.townshipName ?? "all";

  useEffect(() => {
    setSearchTerm(filters.searchTerm);
  }, [filters.searchTerm]);

  useEffect(() => {
    setSelectedStatuses(filters.statuses);
  }, [filters.statuses]);

  const selectableParcelIds = useMemo(
    () =>
      parcels
        .filter(
          (parcel) =>
            parcel.riderName === null &&
            ["at_office", "postpone", "canceled_returned"].includes(parcel.status),
        )
        .map((parcel) => parcel.id),
    [parcels],
  );

  useEffect(() => {
    if (!isFilterOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      const targetElement = target instanceof HTMLElement ? target : null;
      const isComboboxContentClick = targetElement?.closest("[data-slot='combobox-content']");

      if (isComboboxContentClick) {
        return;
      }

      if (filterRef.current && !filterRef.current.contains(target)) {
        setIsFilterOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFilterOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFilterOpen]);

  useEffect(() => {
    setSelectedParcelIds((current) => current.filter((id) => selectableParcelIds.includes(id)));
  }, [selectableParcelIds]);

  useEffect(() => {
    if (selectedParcelIds.length === 0 && isAssignDialogOpen) {
      setIsAssignDialogOpen(false);
    }
  }, [isAssignDialogOpen, selectedParcelIds.length]);

  const townshipOptions: TownshipOption[] = townships.map((township) => ({
    value: township.name,
    label: township.name,
  }));
  const selectedTownshipOption =
    townshipOptions.find((option) => option.value === selectedTownship) ?? null;

  const selectedParcels = useMemo(
    () => parcels.filter((parcel) => selectedParcelIds.includes(parcel.id)),
    [parcels, selectedParcelIds],
  );
  const selectedExpectedCollection = selectedParcels
    .filter((parcel) => parcel.status !== "canceled_returned")
    .reduce((sum, parcel) => sum + parcel.codAmount + parcel.deliveryFee, 0);

  const activeFilterCount = selectedStatuses.length + (selectedTownship === "all" ? 0 : 1);

  function updateFilters(
    next: Partial<{
      query: string;
      assignment: AdminParcelAssignmentFilter;
      township: string | null;
      statuses: ParcelStatus[];
      page: number;
    }>,
  ) {
    const params = new URLSearchParams();
    const nextQuery = next.query ?? filters.searchTerm;
    const nextAssignment = next.assignment ?? filters.assignment;
    const nextTownship = next.township === undefined ? filters.townshipName : next.township;
    const nextStatuses = next.statuses ?? filters.statuses;
    const nextPage = next.page ?? filters.page;

    if (nextQuery.trim()) {
      params.set("query", nextQuery.trim());
    }

    if (nextAssignment !== "all") {
      params.set("assignment", nextAssignment);
    }

    if (nextTownship) {
      params.set("township", nextTownship);
    }

    if (nextStatuses.length > 0) {
      params.set("statuses", nextStatuses.join(","));
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function toggleStatus(status: ParcelStatus) {
    const nextStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((value) => value !== status)
      : [...selectedStatuses, status];

    setSelectedStatuses(nextStatuses);
    updateFilters({ statuses: nextStatuses, page: 1 });
  }

  function resetFilters() {
    setSelectedStatuses([]);
    updateFilters({ township: null, statuses: [], page: 1 });
  }

  function openParcelDetail(parcelId: string, onOpen: (parcel: ParcelListItemDto) => void) {
    startParcelDetailTransition(async () => {
      const parcel = await getAdminParcelDetailAction(parcelId);
      onOpen(parcel);
    });
  }

  function handleEditParcel(parcel: ParcelListItemDto) {
    setViewingParcel(null);
    openParcelDetail(parcel.id, setEditingParcel);
  }

  function handleViewParcel(parcel: ParcelListItemDto) {
    setEditingParcel(null);
    openParcelDetail(parcel.id, setViewingParcel);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <Tabs
          value={filters.assignment}
          onValueChange={(value) => {
            if (isAssignmentFilter(value)) {
              updateFilters({ assignment: value, page: 1 });
            }
          }}
        >
          <TabsList className="rounded-lg border border-border bg-[#f3f2ef] p-1">
            {assignmentFilters.map((value) => (
              <TabsTrigger
                key={value}
                value={value}
                className="gap-2 rounded-md border-0 px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-foreground"
              >
                <span>{assignmentFilterLabels[value]}</span>
                <span className="text-xs text-muted-foreground">
                  {pageResult.assignmentCounts[value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="min-w-[168px] justify-between rounded-lg border-border bg-white px-4 shadow-sm"
            disabled={selectedParcels.length === 0}
            onClick={() => setIsAssignDialogOpen(true)}
          >
            <span className="flex items-center gap-2">
              <Route className="size-4" />
              Assign Rider
            </span>
            {selectedParcels.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {selectedParcels.length} selected
              </span>
            ) : null}
          </Button>

          <form
            className="relative min-w-0 flex-1 sm:w-[340px]"
            onSubmit={(event) => {
              event.preventDefault();
              updateFilters({ query: searchTerm, page: 1 });
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search parcel code, receiver phone, receiver name, merchant"
              className="pl-9"
            />
          </form>

          <div className="relative" ref={filterRef}>
            <Button
              type="button"
              variant="outline"
              className="min-w-[120px] justify-between rounded-lg border-border bg-white px-4 shadow-sm"
              onClick={() => setIsFilterOpen((current) => !current)}
              aria-haspopup="dialog"
              aria-expanded={isFilterOpen}
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4" />
                Filter
                {activeFilterCount > 0 ? (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                className={cn("size-4 transition-transform", isFilterOpen && "rotate-180")}
              />
            </Button>

            {isFilterOpen ? (
              <div className="absolute top-full left-0 z-20 mt-2 w-[320px] rounded-xl border bg-white p-4 shadow-2xl sm:right-0 sm:left-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Filter parcels</div>
                    <div className="text-xs text-muted-foreground">
                      Refine the current parcel list.
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2 text-sm"
                    onClick={resetFilters}
                  >
                    Reset
                  </Button>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-foreground">Township</div>
                    <Combobox
                      items={townshipOptions}
                      value={selectedTownshipOption}
                      onValueChange={(option) =>
                        updateFilters({
                          township: option?.value ?? null,
                          page: 1,
                        })
                      }
                      itemToStringLabel={(option) => option.label}
                      isItemEqualToValue={(item, value) => item.value === value.value}
                    >
                      <ComboboxInput
                        id={townshipInputId}
                        placeholder="All townships"
                        showClear={selectedTownship !== "all"}
                        className="w-full rounded-md text-sm"
                      />
                      <ComboboxContent className="z-30">
                        <ComboboxEmpty>No townships found.</ComboboxEmpty>
                        <ComboboxCollection>
                          {(option: TownshipOption) => (
                            <ComboboxItem key={option.value} value={option}>
                              {option.label}
                            </ComboboxItem>
                          )}
                        </ComboboxCollection>
                      </ComboboxContent>
                    </Combobox>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-medium text-foreground">Parcel status</div>
                    <div className="space-y-2">
                      {parcelStatuses.map((status) => {
                        const checkboxId = `status-${status}`;
                        const isChecked = selectedStatuses.includes(status);

                        return (
                          <label
                            key={status}
                            htmlFor={checkboxId}
                            className="flex cursor-pointer items-center justify-between rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-secondary/60"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id={checkboxId}
                                checked={isChecked}
                                onCheckedChange={() => toggleStatus(status)}
                                aria-label={parcelStatusLabels[status]}
                                className="rounded-[6px] shadow-sm"
                              />
                              <span className="text-sm text-foreground">
                                {parcelStatusLabels[status]}
                              </span>
                            </div>
                            {isChecked ? <Check className="size-4 text-primary" /> : null}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {selectedParcels.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed bg-[#fcfbf8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">
              {selectedParcels.length} parcel{selectedParcels.length > 1 ? "s" : ""} selected
            </div>
            <div className="text-xs text-muted-foreground">
              Current selection expected collection: {formatMoney(selectedExpectedCollection)} MMK
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Selection stays available while you search and filter this list.
          </div>
        </div>
      ) : null}

      <ParcelTable
        parcels={parcels}
        selectedParcelIds={selectedParcelIds}
        onSelectedParcelIdsChange={setSelectedParcelIds}
        onView={handleViewParcel}
        onEdit={handleEditParcel}
        enableSelection
        enableFailureReview
      />

      <PaginationControls
        page={pageResult.page}
        totalPages={pageResult.totalPages}
        onPageChange={(page) => updateFilters({ page })}
      />

      <AssignRiderDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        selectedParcels={selectedParcels}
        riders={riders}
      />

      <Sheet
        open={viewingParcel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewingParcel(null);
          }
        }}
      >
        <SheetContent className="overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[720px] data-[side=right]:sm:max-w-[720px]">
          {viewingParcel ? (
            <ParcelDetailSheet actorRole={actorRole} parcel={viewingParcel} riders={riders} />
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet
        open={editingParcel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingParcel(null);
          }
        }}
      >
        <SheetContent className="overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[720px] data-[side=right]:sm:max-w-[720px]">
          {editingParcel ? (
            <EditParcelForm
              key={editingParcel.id}
              parcel={editingParcel}
              merchants={merchants}
              townships={townships}
              onSaved={() => setEditingParcel(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
