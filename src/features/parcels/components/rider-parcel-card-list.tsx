"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { FormBanner, type FormMessageState } from "@/components/shared/form-fields";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ParcelDetailSheet } from "@/features/parcels/components/parcel-detail-sheet";
import {
  markRiderParcelReturnedToMerchantAction,
  markRiderParcelDeliveredAction,
  reportDeliveryFailureForRiderParcelAction,
  startDeliveryForRiderParcelsAction,
} from "@/features/parcels/server/actions";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import { useAppRouter } from "@/lib/client-navigation";
import { parcelStatusLabels, parcelStatuses, type ParcelStatus } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type RiderParcelTab = "to_deliver" | "delivered" | "returned";
type TownshipOption = { value: string; label: string };

const riderTabLabels: Record<RiderParcelTab, string> = {
  to_deliver: "To Deliver",
  delivered: "Delivered",
  returned: "Returned",
};

const riderTabs = ["to_deliver", "delivered", "returned"] as const;
const pageSize = 12;
const toDeliverStatuses: ParcelStatus[] = ["at_office", "on_the_way", "canceled_returned"];
const deliveredStatuses: ParcelStatus[] = ["delivered"];
const returnedStatuses: ParcelStatus[] = ["returned_to_merchant"];

function getStatusVariant(status: ParcelStatus) {
  if (status === "delivered") {
    return "success";
  }

  if (status === "at_office") {
    return "secondary";
  }

  return "warning";
}

function getTabStatuses(tab: RiderParcelTab) {
  if (tab === "delivered") {
    return deliveredStatuses;
  }

  if (tab === "returned") {
    return returnedStatuses;
  }

  return toDeliverStatuses;
}

function isRiderParcelTab(value: string): value is RiderParcelTab {
  return value === "to_deliver" || value === "delivered" || value === "returned";
}

export function RiderParcelCardList({
  parcels,
}: Readonly<{
  parcels: ParcelListItemDto[];
}>) {
  const router = useAppRouter();
  const filterRef = useRef<HTMLDivElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const townshipInputId = useId();
  const failureNoteId = useId();
  const proofInputId = useId();
  const [activeTab, setActiveTab] = useState<RiderParcelTab>("to_deliver");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTownship, setSelectedTownship] = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState<ParcelStatus[]>([]);
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([]);
  const [expandedParcelId, setExpandedParcelId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewingParcel, setViewingParcel] = useState<ParcelListItemDto | null>(null);
  const [failureParcel, setFailureParcel] = useState<ParcelListItemDto | null>(null);
  const [deliveryParcel, setDeliveryParcel] = useState<ParcelListItemDto | null>(null);
  const [failureNote, setFailureNote] = useState("");
  const [failureNotePendingAction, setFailureNotePendingAction] = useState<
    "save" | "delete" | null
  >(null);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const [isPending, startTransition] = useTransition();

  const townshipOptions = useMemo<TownshipOption[]>(
    () =>
      [...new Set(parcels.map((parcel) => parcel.townshipName))]
        .toSorted((left, right) => left.localeCompare(right))
        .map((township) => ({ value: township, label: township })),
    [parcels],
  );
  const selectedTownshipOption =
    townshipOptions.find((option) => option.value === selectedTownship) ?? null;

  const tabCounts = useMemo(
    () => ({
      to_deliver: parcels.filter((parcel) => getTabStatuses("to_deliver").includes(parcel.status))
        .length,
      delivered: parcels.filter((parcel) => getTabStatuses("delivered").includes(parcel.status))
        .length,
      returned: parcels.filter((parcel) => getTabStatuses("returned").includes(parcel.status))
        .length,
    }),
    [parcels],
  );

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const eligibleParcelIds = useMemo(
    () => parcels.filter((parcel) => parcel.status === "at_office").map((parcel) => parcel.id),
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
    setSelectedParcelIds((current) => current.filter((id) => eligibleParcelIds.includes(id)));
  }, [eligibleParcelIds]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, normalizedSearchTerm, selectedTownship, selectedStatuses]);

  useEffect(() => {
    if (expandedParcelId && !parcels.some((parcel) => parcel.id === expandedParcelId)) {
      setExpandedParcelId(null);
    }
  }, [expandedParcelId, parcels]);

  useEffect(() => {
    if (!proofPreviewUrl) {
      return undefined;
    }

    return () => {
      URL.revokeObjectURL(proofPreviewUrl);
    };
  }, [proofPreviewUrl]);

  const filteredParcels = useMemo(() => {
    const tabStatuses = getTabStatuses(activeTab);

    return parcels.filter((parcel) => {
      if (!tabStatuses.includes(parcel.status)) {
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

      return [parcel.parcelCode, parcel.receiverName, parcel.receiverPhoneNumber].some((value) =>
        value.toLowerCase().includes(normalizedSearchTerm),
      );
    });
  }, [activeTab, normalizedSearchTerm, parcels, selectedStatuses, selectedTownship]);

  const totalPages = Math.max(1, Math.ceil(filteredParcels.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedParcels = filteredParcels.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize,
  );
  const selectedParcels = useMemo(
    () => parcels.filter((parcel) => selectedParcelIds.includes(parcel.id)),
    [parcels, selectedParcelIds],
  );
  const selectedAmountToCollect = selectedParcels.reduce(
    (sum, parcel) => sum + parcel.codAmount + parcel.deliveryFee,
    0,
  );
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

  function toggleParcel(parcelId: string, checked: boolean) {
    setSelectedParcelIds((current) => {
      if (checked) {
        return current.includes(parcelId) ? current : [...current, parcelId];
      }

      return current.filter((id) => id !== parcelId);
    });
  }

  function toggleExpansion(parcelId: string) {
    setExpandedParcelId((current) => (current === parcelId ? null : parcelId));
  }

  function submitStartDelivery(parcelIds: string[]) {
    if (parcelIds.length === 0) {
      return;
    }

    setSubmissionState(null);
    startTransition(async () => {
      const result = await startDeliveryForRiderParcelsAction({ parcelIds });

      if (!result.ok) {
        setSubmissionState({
          kind: "error",
          message: result.message,
        });
        return;
      }

      setSubmissionState({
        kind: "success",
        message: result.message,
      });
      setSelectedParcelIds((current) => current.filter((id) => !parcelIds.includes(id)));
      router.refresh();
    });
  }

  function submitReturnToMerchant(parcelId: string) {
    setSubmissionState(null);
    startTransition(async () => {
      const result = await markRiderParcelReturnedToMerchantAction({ parcelId });

      setSubmissionState({
        kind: result.ok ? "success" : "error",
        message: result.message,
      });

      if (!result.ok) {
        return;
      }

      setExpandedParcelId((current) => (current === parcelId ? null : current));
      router.refresh();
    });
  }

  function openFailureDialog(parcel: ParcelListItemDto) {
    setSubmissionState(null);
    setFailureNotePendingAction(null);
    setFailureNote(parcel.activeFailureNote?.note ?? "");
    setFailureParcel(parcel);
  }

  function openDeliveryDialog(parcel: ParcelListItemDto) {
    setSubmissionState(null);
    setProofImage(null);
    setProofPreviewUrl(null);
    if (proofInputRef.current) {
      proofInputRef.current.value = "";
    }
    setDeliveryParcel(parcel);
  }

  function handleProofImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setProofImage(file);
    setProofPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function submitFailureReport(event: { preventDefault: () => void }) {
    event.preventDefault();

    if (!failureParcel) {
      return;
    }

    setSubmissionState(null);
    setFailureNotePendingAction("save");
    startTransition(async () => {
      const result = await reportDeliveryFailureForRiderParcelAction({
        parcelId: failureParcel.id,
        note: failureNote,
      });

      setSubmissionState({
        kind: result.ok ? "success" : "error",
        message: result.message,
      });
      setFailureNotePendingAction(null);

      if (!result.ok) {
        return;
      }

      setFailureParcel(null);
      setFailureNote("");
      router.refresh();
    });
  }

  function submitDelivered(event: { preventDefault: () => void }) {
    event.preventDefault();

    if (!deliveryParcel) {
      return;
    }

    if (!proofImage) {
      setSubmissionState({
        kind: "error",
        message: "Delivery proof photo is required.",
      });
      return;
    }

    const formData = new FormData();
    formData.set("parcelId", deliveryParcel.id);
    formData.set("proofImage", proofImage);

    setSubmissionState(null);
    startTransition(async () => {
      const result = await markRiderParcelDeliveredAction(formData);

      setSubmissionState({
        kind: result.ok ? "success" : "error",
        message: result.message,
      });

      if (!result.ok) {
        return;
      }

      setDeliveryParcel(null);
      setProofImage(null);
      setProofPreviewUrl(null);
      setExpandedParcelId((current) => (current === deliveryParcel.id ? null : current));
      router.refresh();
    });
  }

  function renderParcelContent() {
    if (parcels.length === 0) {
      return (
        <div className="rounded-xl border border-dashed bg-[#fcfbf8] px-6 py-12 text-center">
          <div className="text-base font-medium text-foreground">No assigned parcels yet</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Assigned rider parcels will appear here once the office team sends work to your account.
          </div>
        </div>
      );
    }

    if (filteredParcels.length === 0) {
      return (
        <div className="rounded-xl border border-dashed bg-[#fcfbf8] px-6 py-12 text-center">
          <div className="text-base font-medium text-foreground">
            No parcels match these filters
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Try another tab, clear your search, or reset township and status filters.
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {paginatedParcels.map((parcel) => {
            const isExpanded = expandedParcelId === parcel.id;
            const isSelected = selectedParcelIds.includes(parcel.id);
            const isSelectable = parcel.status === "at_office";
            const amountToCollect = parcel.codAmount + parcel.deliveryFee;
            const hasFailureNote = parcel.activeFailureNote !== null;
            const showDeliveryActions = parcel.status === "on_the_way" && !hasFailureNote;
            const showFailureNoteAction = parcel.status === "on_the_way" && hasFailureNote;
            const showReturnAction = parcel.status === "canceled_returned";

            return (
              <Card
                key={parcel.id}
                className="border border-[#e7dfd8] bg-white py-0 shadow-[0_18px_45px_rgba(27,25,56,0.06)]"
              >
                <CardContent className="p-0">
                  <div className="flex items-start justify-between gap-3 border-b border-[#f1e8e0] px-5 py-4">
                    <div className="flex flex-col items-start">
                      <div className="mt-1 font-mono text-sm text-foreground">
                        {parcel.parcelCode}
                      </div>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto border-0 px-0 text-sm underline"
                        onClick={() => setViewingParcel(parcel)}
                      >
                        View details
                      </Button>
                    </div>
                    <Checkbox
                      aria-label={`Select ${parcel.parcelCode}`}
                      checked={isSelected}
                      disabled={!isSelectable || isPending}
                      onClick={(event) => event.stopPropagation()}
                      onCheckedChange={(checked) => toggleParcel(parcel.id, checked)}
                      className={cn(
                        "mt-1 rounded-[6px] shadow-sm",
                        !isSelectable && "border-0 shadow-none",
                      )}
                    />
                  </div>

                  <button
                    type="button"
                    className="block w-full px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    onClick={() => toggleExpansion(parcel.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-md font-semibold text-foreground">
                          {parcel.receiverName}
                        </div>
                        <div className="text-xs text-muted-foreground">{parcel.townshipName}</div>
                      </div>
                      <StatusBadge
                        label={parcelStatusLabels[parcel.status]}
                        variant={getStatusVariant(parcel.status)}
                        className="shrink-0"
                      />
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="space-y-4 border-t border-dashed border-[#eadfd6] px-5 py-4">
                      <div className="space-y-3 text-sm text-foreground">
                        <div>
                          <div className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                            Phone
                          </div>
                          <div className="mt-1 leading-6">{parcel.receiverPhoneNumber}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                            Address
                          </div>
                          <div className="mt-1 leading-6">{parcel.receiverAddress}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                            Amount to Collect
                          </div>
                          <div className="text-md mt-1 font-semibold text-foreground">
                            {formatMoney(amountToCollect)} MMK
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {isSelectable ? (
                          <Button
                            type="button"
                            disabled={isPending}
                            onClick={() => submitStartDelivery([parcel.id])}
                          >
                            {isPending ? "Starting..." : "Start Delivery"}
                          </Button>
                        ) : null}

                        {showDeliveryActions ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isPending}
                              className="flex-1"
                              onClick={() => openFailureDialog(parcel)}
                            >
                              Report Failure
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isPending}
                              className="flex-1"
                              onClick={() => openDeliveryDialog(parcel)}
                            >
                              Mark Delivered
                            </Button>
                          </>
                        ) : null}

                        {showFailureNoteAction ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            className="flex-1"
                            onClick={() => openFailureDialog(parcel)}
                          >
                            View Failure Note
                          </Button>
                        ) : null}

                        {showReturnAction ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            className="flex-1"
                            onClick={() => submitReturnToMerchant(parcel.id)}
                          >
                            Return to Merchant
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(safeCurrentPage - 1) * pageSize + 1}-
            {Math.min(safeCurrentPage * pageSize, filteredParcels.length)} of{" "}
            {filteredParcels.length} parcels
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <div className="min-w-[96px] flex-1 text-center text-sm text-foreground">
              Page {safeCurrentPage} of {totalPages}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safeCurrentPage === totalPages}
              onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (isRiderParcelTab(value)) {
              setActiveTab(value);
            }
          }}
        >
          <TabsList className="rounded-lg border border-border bg-[#f3f2ef] p-1">
            {riderTabs.map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="gap-2 rounded-md border-0 px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-foreground"
              >
                <span>{riderTabLabels[tab]}</span>
                <span className="text-xs text-muted-foreground">{tabCounts[tab]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:w-[340px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search parcel code, receiver name, or phone"
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
              <div className="absolute top-full right-0 z-20 mt-2 w-[320px] rounded-xl border bg-white p-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">Filter parcels</div>
                    <div className="text-xs text-muted-foreground">
                      Refine the current rider parcel list.
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
                    <label
                      htmlFor={townshipInputId}
                      className="text-sm font-medium text-foreground"
                    >
                      Township
                    </label>
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
                        const checkboxId = `rider-status-${status}`;
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

      {submissionState ? <FormBanner state={submissionState} /> : null}

      {selectedParcels.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-[#fcfbf8] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">
              {selectedParcels.length} parcel{selectedParcels.length > 1 ? "s" : ""} selected
            </div>
            <div className="text-xs text-muted-foreground">
              Amount to collect: {formatMoney(selectedAmountToCollect)} MMK
            </div>
          </div>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => submitStartDelivery(selectedParcelIds)}
          >
            {isPending ? "Starting..." : "Start Delivery for Selected"}
          </Button>
        </div>
      ) : null}

      {renderParcelContent()}

      <Sheet
        open={viewingParcel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewingParcel(null);
          }
        }}
      >
        <SheetContent className="overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[720px] data-[side=right]:sm:max-w-[720px]">
          {viewingParcel ? <ParcelDetailSheet parcel={viewingParcel} /> : null}
        </SheetContent>
      </Sheet>

      <Dialog
        open={failureParcel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFailureParcel(null);
            setFailureNote("");
            setFailureNotePendingAction(null);
          }
        }}
      >
        <DialogContent>
              <form className="space-y-5" onSubmit={submitFailureReport}>
            <DialogHeader>
              <DialogTitle>
                {failureParcel?.activeFailureNote ? "Failure Note" : "Report Failure"}
              </DialogTitle>
              <DialogDescription>
                {failureParcel?.parcelCode} · {failureParcel?.receiverName}
              </DialogDescription>
            </DialogHeader>

            {submissionState && failureParcel ? <FormBanner state={submissionState} /> : null}

            <div className="space-y-2">
              <Label htmlFor={failureNoteId}>Failure note</Label>
              {failureParcel?.activeFailureNote ? (
                <div className="min-h-32 rounded-lg border bg-secondary/40 px-3 py-2 text-sm text-foreground">
                  {failureNote}
                </div>
              ) : (
                <Textarea
                  id={failureNoteId}
                  value={failureNote}
                  onChange={(event) => setFailureNote(event.target.value)}
                  minLength={1}
                  required
                  disabled={isPending}
                  placeholder="Write what happened during delivery"
                  className="min-h-32"
                />
              )}
            </div>

            <DialogFooter>
              {failureParcel?.activeFailureNote ? (
                <Button type="button" onClick={() => setFailureParcel(null)}>
                  Close
                </Button>
              ) : (
                <Button type="submit" disabled={isPending}>
                  {failureNotePendingAction === "save" ? "Saving..." : "Save"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deliveryParcel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeliveryParcel(null);
            setProofImage(null);
            setProofPreviewUrl(null);
          }
        }}
      >
        <DialogContent>
          <form className="space-y-5" onSubmit={submitDelivered}>
            <DialogHeader>
              <DialogTitle>Mark Delivered</DialogTitle>
              <DialogDescription>
                {deliveryParcel?.parcelCode} · {deliveryParcel?.receiverName}
              </DialogDescription>
            </DialogHeader>

            {submissionState && deliveryParcel ? <FormBanner state={submissionState} /> : null}

            <div className="rounded-lg border bg-secondary/40 px-4 py-3">
              <div className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Collection Amount
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {deliveryParcel
                  ? `${formatMoney(deliveryParcel.codAmount + deliveryParcel.deliveryFee)} MMK`
                  : "0 MMK"}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor={proofInputId}>Delivery proof photo</Label>
              <input
                ref={proofInputRef}
                id={proofInputId}
                name="proofImage"
                type="file"
                accept="image/*"
                capture="environment"
                required
                disabled={isPending}
                className="sr-only"
                onChange={handleProofImageChange}
              />
              <Label
                htmlFor={proofInputId}
                className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-white px-4 py-5 text-center transition-colors hover:bg-secondary/50"
              >
                {proofPreviewUrl ? (
                  <div
                    role="img"
                    aria-label="Delivery proof preview"
                    className="h-56 w-full rounded-md bg-contain bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${proofPreviewUrl})` }}
                  />
                ) : (
                  <>
                    <Camera className="size-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Take or choose delivery proof photo
                    </span>
                  </>
                )}
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  setDeliveryParcel(null);
                  setProofImage(null);
                  setProofPreviewUrl(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Delivery"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
