"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Route, Search, SlidersHorizontal } from "lucide-react";

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
import { ParcelDetailSheet } from "@/features/parcels/components/parcel-detail-sheet";
import { ParcelTable } from "@/features/parcels/components/parcel-table";
import type { MerchantListItemDto } from "@/features/merchants/server/dto";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import type { RiderListItemDto } from "@/features/riders/server/dto";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { parcelStatusLabels, parcelStatuses, type ParcelStatus, type UserRole } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type AssignmentFilter = "all" | "unassigned" | "assigned" | "need_review";
type TownshipOption = { value: string; label: string };

const assignmentFilterLabels: Record<AssignmentFilter, string> = {
  all: "All",
  unassigned: "Unassigned",
  assigned: "Assigned",
  need_review: "Need review",
};

const assignmentFilters = ["all", "unassigned", "assigned", "need_review"] as const;

function isAssignmentFilter(value: string): value is AssignmentFilter {
  return (
    value === "all" || value === "unassigned" || value === "assigned" || value === "need_review"
  );
}

export function ParcelListView({
  actorRole,
  parcels,
  merchants,
  riders,
  townships,
}: Readonly<{
  actorRole: UserRole;
  parcels: ParcelListItemDto[];
  merchants: MerchantListItemDto[];
  riders: RiderListItemDto[];
  townships: TownshipListItemDto[];
}>) {
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTownship, setSelectedTownship] = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState<ParcelStatus[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([]);
  const [editingParcel, setEditingParcel] = useState<ParcelListItemDto | null>(null);
  const [viewingParcel, setViewingParcel] = useState<ParcelListItemDto | null>(null);

  const filterRef = useRef<HTMLDivElement>(null);
  const townshipInputId = useId();
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

  const townshipNames = [...new Set(parcels.map((parcel) => parcel.townshipName))].toSorted(
    (left, right) => left.localeCompare(right),
  );
  const townshipOptions: TownshipOption[] = townshipNames.map((township) => ({
    value: township,
    label: township,
  }));
  const selectedTownshipOption =
    townshipOptions.find((option) => option.value === selectedTownship) ?? null;

  const assignmentCounts = {
    all: parcels.length,
    unassigned: parcels.filter((parcel) => parcel.riderName === null).length,
    assigned: parcels.filter((parcel) => parcel.riderName !== null).length,
    need_review: parcels.filter((parcel) => parcel.activeFailureNote !== null).length,
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredParcels = parcels.filter((parcel) => {
    if (assignmentFilter === "unassigned" && parcel.riderName !== null) {
      return false;
    }

    if (assignmentFilter === "assigned" && parcel.riderName === null) {
      return false;
    }

    if (assignmentFilter === "need_review" && parcel.activeFailureNote === null) {
      return false;
    }

    if (selectedTownship !== "all" && parcel.townshipName !== selectedTownship) {
      return false;
    }

    if (selectedStatuses.length > 0 && !selectedStatuses.includes(parcel.status)) {
      return false;
    }

    if (!normalizedSearchTerm) {
      return true;
    }

    return [
      parcel.parcelCode,
      parcel.receiverPhoneNumber,
      parcel.receiverName,
      parcel.merchantName,
    ].some((value) => value.toLowerCase().includes(normalizedSearchTerm));
  });

  const selectedParcels = useMemo(
    () => parcels.filter((parcel) => selectedParcelIds.includes(parcel.id)),
    [parcels, selectedParcelIds],
  );
  const currentViewingParcel = viewingParcel
    ? (parcels.find((parcel) => parcel.id === viewingParcel.id) ?? viewingParcel)
    : null;
  const selectedExpectedCollection = selectedParcels
    .filter((parcel) => parcel.status !== "canceled_returned")
    .reduce((sum, parcel) => sum + parcel.codAmount + parcel.deliveryFee, 0);

  const activeFilterCount = selectedStatuses.length + (selectedTownship === "all" ? 0 : 1);

  function toggleStatus(status: ParcelStatus) {
    setSelectedStatuses((current) =>
      current.includes(status) ? current.filter((value) => value !== status) : [...current, status],
    );
  }

  function resetFilters() {
    setSelectedTownship("all");
    setSelectedStatuses([]);
  }

  function handleEditParcel(parcel: ParcelListItemDto) {
    setViewingParcel(null);
    setEditingParcel(parcel);
  }

  function handleViewParcel(parcel: ParcelListItemDto) {
    setEditingParcel(null);
    setViewingParcel(parcel);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <Tabs
          value={assignmentFilter}
          onValueChange={(value) => {
            if (isAssignmentFilter(value)) {
              setAssignmentFilter(value);
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
                <span className="text-xs text-muted-foreground">{assignmentCounts[value]}</span>
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

          <div className="relative min-w-0 flex-1 sm:w-[340px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search parcel code, receiver phone, receiver name, merchant"
              className="pl-9"
            />
          </div>

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
                      onValueChange={(option) => setSelectedTownship(option?.value ?? "all")}
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
        parcels={filteredParcels}
        selectedParcelIds={selectedParcelIds}
        onSelectedParcelIdsChange={setSelectedParcelIds}
        onView={handleViewParcel}
        onEdit={handleEditParcel}
        enableSelection
        enableFailureReview
      />

      <AssignRiderDialog
        open={isAssignDialogOpen}
        onOpenChange={setIsAssignDialogOpen}
        selectedParcels={selectedParcels}
        riders={riders}
      />

      <Sheet
        open={currentViewingParcel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewingParcel(null);
          }
        }}
      >
        <SheetContent className="overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[720px] data-[side=right]:sm:max-w-[720px]">
          {currentViewingParcel ? (
            <ParcelDetailSheet
              actorRole={actorRole}
              parcel={currentViewingParcel}
              riders={riders}
            />
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
