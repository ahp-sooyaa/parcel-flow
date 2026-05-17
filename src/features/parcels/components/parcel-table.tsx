"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
}: Readonly<{
  parcels: ParcelListItemDto[];
  selectedParcelIds?: string[];
  onSelectedParcelIdsChange?: (parcelIds: string[]) => void;
  onView?: (parcel: ParcelListItemDto) => void;
  onEdit?: (parcel: ParcelListItemDto) => void;
  enableSelection?: boolean;
}>) {
  const hasActions = onView !== undefined || onEdit !== undefined;
  const [internalSelectedParcelIds, setInternalSelectedParcelIds] = useState<string[]>([]);
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
                <TableCell className="font-medium">{parcel.parcelCode}</TableCell>
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
    </div>
  );
}
