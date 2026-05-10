"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search, SlidersHorizontal } from "lucide-react";

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
import { CreateParcelForm } from "@/features/parcels/components/create-parcel-form";
import { ParcelTable } from "@/features/parcels/components/parcel-table";
import type { MerchantListItemDto } from "@/features/merchants/server/dto";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { parcelStatusLabels, parcelStatuses, type ParcelStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";

type AssignmentFilter = "all" | "unassigned" | "assigned";
type TownshipOption = { value: string; label: string };

const assignmentFilterLabels: Record<AssignmentFilter, string> = {
  all: "All",
  unassigned: "Unassigned",
  assigned: "Assigned",
};

export function ParcelListView({
  parcels,
  merchants,
  townships,
}: Readonly<{
  parcels: ParcelListItemDto[];
  merchants: MerchantListItemDto[];
  townships: TownshipListItemDto[];
}>) {
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTownship, setSelectedTownship] = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState<ParcelStatus[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [editingParcel, setEditingParcel] = useState<ParcelListItemDto | null>(null);

  const filterRef = useRef<HTMLDivElement>(null);
  const townshipInputId = useId();

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const isComboboxContentClick = target?.closest("[data-slot='combobox-content']");

      if (isComboboxContentClick) {
        return;
      }

      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
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

  const townshipNames = [...new Set(parcels.map((parcel) => parcel.townshipName))].sort((left, right) =>
    left.localeCompare(right),
  );
  const townshipOptions: TownshipOption[] = townshipNames.map((township) => ({ value: township, label: township }));
  const selectedTownshipOption =
    townshipOptions.find((option) => option.value === selectedTownship) ?? null;

  const assignmentCounts = {
    all: parcels.length,
    unassigned: parcels.filter((parcel) => parcel.riderName === null).length,
    assigned: parcels.filter((parcel) => parcel.riderName !== null).length,
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredParcels = parcels.filter((parcel) => {
    if (assignmentFilter === "unassigned" && parcel.riderName !== null) {
      return false;
    }

    if (assignmentFilter === "assigned" && parcel.riderName === null) {
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

    return [parcel.parcelCode, parcel.receiverPhoneNumber, parcel.receiverName, parcel.merchantName].some((value) =>
      value.toLowerCase().includes(normalizedSearchTerm),
    );
  });

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={assignmentFilter} onValueChange={(value) => setAssignmentFilter(value as AssignmentFilter)}>
          <TabsList className="rounded-lg border border-border bg-[#f3f2ef] p-1">
            {Object.entries(assignmentFilterLabels).map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="gap-2 rounded-md px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-foreground"
              >
                <span>{label}</span>
                <span className="text-xs text-muted-foreground">{assignmentCounts[value as AssignmentFilter]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:w-[340px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
              <ChevronDown className={cn("size-4 transition-transform", isFilterOpen && "rotate-180")} />
            </Button>

            {isFilterOpen ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-[320px] rounded-xl border bg-white p-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Filter parcels</div>
                    <div className="text-xs text-muted-foreground">Refine the current parcel list.</div>
                  </div>
                  <Button type="button" variant="ghost" className="h-8 px-2 text-sm" onClick={resetFilters}>
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
                              />
                              <span className="text-sm text-foreground">{parcelStatusLabels[status]}</span>
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

      <ParcelTable parcels={filteredParcels} onEdit={setEditingParcel} />

      <Sheet
        open={editingParcel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingParcel(null);
          }
        }}
      >
        <SheetContent className="w-full max-w-[560px] overflow-hidden p-0">
          {editingParcel ? (
            <CreateParcelForm
              key={editingParcel.id}
              merchants={merchants}
              townships={townships}
              title="Edit Parcel"
              submitLabel="Save Changes"
              initialValues={{
                merchantName: editingParcel.merchantName,
                receiverName: editingParcel.receiverName,
                receiverPhoneNumber: editingParcel.receiverPhoneNumber,
                townshipName: editingParcel.townshipName,
                deliveryFee: String(editingParcel.deliveryFee),
                hasCod: editingParcel.codAmount > 0,
                codFee: editingParcel.codAmount > 0 ? String(editingParcel.codAmount) : "",
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
