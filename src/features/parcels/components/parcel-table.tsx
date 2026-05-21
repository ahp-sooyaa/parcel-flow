"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, MoreHorizontal } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  postponeFailedParcelAction,
  returnFailedParcelToMerchantAction,
} from "@/features/parcels/server/actions";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import { parcelStatusLabels } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";

const assignmentEligibleStatuses = ["at_office", "postpone", "canceled_returned"] as const;

function getStatusVariant(status: ParcelListItemDto["status"]) {
  if (status === "delivered") {
    return "success";
  }

  if (status === "at_office") {
    return "secondary";
  }

  return "warning";
}

export function ParcelTable({
  parcels,
  selectedParcelIds,
  onSelectedParcelIdsChange,
  onView,
  onEdit,
  enableSelection = false,
  enableFailureReview = false,
}: Readonly<{
  parcels: ParcelListItemDto[];
  selectedParcelIds?: string[];
  onSelectedParcelIdsChange?: (parcelIds: string[]) => void;
  onView?: (parcel: ParcelListItemDto) => void;
  onEdit?: (parcel: ParcelListItemDto) => void;
  enableSelection?: boolean;
  enableFailureReview?: boolean;
}>) {
  const hasActions = onView !== undefined || onEdit !== undefined;
  const [internalSelectedParcelIds, setInternalSelectedParcelIds] = useState<string[]>([]);
  const [failureReviewParcel, setFailureReviewParcel] = useState<ParcelListItemDto | null>(null);
  const [failureReviewError, setFailureReviewError] = useState<string | null>(null);
  const [pendingFailureAction, setPendingFailureAction] = useState<
    "postpone" | "return_merchant" | null
  >(null);
  const selectableParcelIds = useMemo(
    () =>
      parcels
        .filter(
          (parcel) =>
            parcel.riderName === null &&
            assignmentEligibleStatuses.some((status) => status === parcel.status),
        )
        .map((parcel) => parcel.id),
    [parcels],
  );
  const currentSelectedParcelIds = selectedParcelIds ?? internalSelectedParcelIds;
  const allVisibleSelected =
    selectableParcelIds.length > 0 &&
    selectableParcelIds.every((id) => currentSelectedParcelIds.includes(id));
  const someVisibleSelected = selectableParcelIds.some((id) =>
    currentSelectedParcelIds.includes(id),
  );

  useEffect(() => {
    if (selectedParcelIds !== undefined) {
      return;
    }

    setInternalSelectedParcelIds((current) =>
      current.filter((id) => selectableParcelIds.includes(id)),
    );
  }, [selectableParcelIds, selectedParcelIds]);

  function handleSelectedParcelIdsChange(nextSelectedParcelIds: string[]) {
    if (onSelectedParcelIdsChange) {
      onSelectedParcelIdsChange(nextSelectedParcelIds);
      return;
    }

    setInternalSelectedParcelIds(nextSelectedParcelIds);
  }

  function toggleAllParcels(checked: boolean) {
    if (checked) {
      handleSelectedParcelIdsChange([
        ...new Set([...currentSelectedParcelIds, ...selectableParcelIds]),
      ]);
      return;
    }

    handleSelectedParcelIdsChange(
      currentSelectedParcelIds.filter((id) => !selectableParcelIds.includes(id)),
    );
  }

  function toggleParcel(parcelId: string, checked: boolean) {
    if (checked) {
      handleSelectedParcelIdsChange(
        currentSelectedParcelIds.includes(parcelId)
          ? currentSelectedParcelIds
          : [...currentSelectedParcelIds, parcelId],
      );
      return;
    }

    handleSelectedParcelIdsChange(currentSelectedParcelIds.filter((id) => id !== parcelId));
  }

  async function resolveFailure(action: "postpone" | "return_merchant") {
    if (!failureReviewParcel) {
      return;
    }

    setFailureReviewError(null);
    setPendingFailureAction(action);

    const result =
      action === "postpone"
        ? await postponeFailedParcelAction({ parcelId: failureReviewParcel.id })
        : await returnFailedParcelToMerchantAction({ parcelId: failureReviewParcel.id });

    setPendingFailureAction(null);

    if (!result.ok) {
      setFailureReviewError(result.message);
      return;
    }

    setFailureReviewParcel(null);
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              {enableSelection ? (
                <Checkbox
                  aria-label="Select all parcels"
                  checked={allVisibleSelected}
                  indeterminate={!allVisibleSelected && someVisibleSelected}
                  onCheckedChange={toggleAllParcels}
                  className="rounded-[6px] shadow-sm"
                />
              ) : null}
            </TableHead>
            <TableHead>Parcel</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead>Receiver</TableHead>
            <TableHead>Township</TableHead>
            <TableHead>Rider</TableHead>
            <TableHead className="text-right">COD</TableHead>
            <TableHead className="text-right">Fee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            {hasActions ? (
              <TableHead className="w-12 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {parcels.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={hasActions ? 11 : 10}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No parcels match the current search and filters.
              </TableCell>
            </TableRow>
          ) : (
            parcels.map((parcel) => (
              <TableRow key={parcel.id}>
                <TableCell>
                  {enableSelection ? (
                    <Checkbox
                      aria-label={`Select ${parcel.parcelCode}`}
                      checked={currentSelectedParcelIds.includes(parcel.id)}
                      onCheckedChange={(checked) => toggleParcel(parcel.id, checked)}
                      disabled={!selectableParcelIds.includes(parcel.id)}
                      className="rounded-[6px] shadow-sm"
                    />
                  ) : null}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{parcel.parcelCode}</span>
                    {enableFailureReview && parcel.hasUnresolvedFailureReview ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Review failure note for ${parcel.parcelCode}`}
                        onClick={() => {
                          setFailureReviewError(null);
                          setFailureReviewParcel(parcel);
                        }}
                      >
                        <AlertCircle className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{parcel.merchantName}</TableCell>
                <TableCell>
                  <div className="font-medium">{parcel.receiverName}</div>
                  <div className="text-xs text-muted-foreground">{parcel.receiverPhoneNumber}</div>
                </TableCell>
                <TableCell>{parcel.townshipName}</TableCell>
                <TableCell>{parcel.riderName ?? "-"}</TableCell>
                <TableCell className="text-right">{formatMoney(parcel.codAmount)}</TableCell>
                <TableCell className="text-right">{formatMoney(parcel.deliveryFee)}</TableCell>
                <TableCell>
                  <StatusBadge
                    label={parcelStatusLabels[parcel.status]}
                    variant={getStatusVariant(parcel.status)}
                  />
                </TableCell>
                <TableCell>{formatDate(parcel.createdAt)}</TableCell>
                {hasActions ? (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-md text-muted-foreground"
                          aria-label={`Open actions for ${parcel.parcelCode}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[9rem]">
                        <DropdownMenuItem onClick={() => onEdit?.(parcel)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onView?.(parcel)}>View</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <Dialog
        open={failureReviewParcel !== null}
        onOpenChange={(open) => {
          if (!open && pendingFailureAction === null) {
            setFailureReviewParcel(null);
            setFailureReviewError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delivery Failure</DialogTitle>
            <DialogDescription>{failureReviewParcel?.parcelCode}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">Failure note</div>
            <div className="min-h-20 rounded-lg border bg-secondary/40 p-3 text-sm text-foreground">
              {failureReviewParcel?.deliveryFailureNote}
            </div>
            {failureReviewError ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {failureReviewError}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pendingFailureAction !== null}
              onClick={() => void resolveFailure("postpone")}
            >
              {pendingFailureAction === "postpone" ? "Postponing..." : "Postpone"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pendingFailureAction !== null}
              onClick={() => void resolveFailure("return_merchant")}
            >
              {pendingFailureAction === "return_merchant"
                ? "Marking..."
                : "Return Merchant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
