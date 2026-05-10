import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ParcelStatusBadge } from "@/features/parcels/components/parcel-status-badge";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import { formatDate, formatMoney } from "@/lib/format";

export function ParcelTable({
  parcels,
  onEdit,
}: Readonly<{
  parcels: ParcelListItemDto[];
  onEdit?: (parcel: ParcelListItemDto) => void;
}>) {
  const hasActions = onEdit !== undefined;

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox aria-label="Select all parcels" />
            </TableHead>
            <TableHead>Parcel</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead>Receiver</TableHead>
            <TableHead>Township</TableHead>
            <TableHead className="text-right">COD</TableHead>
            <TableHead className="text-right">Fee</TableHead>
            <TableHead>Rider</TableHead>
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
              <TableCell colSpan={hasActions ? 11 : 10} className="py-10 text-center text-sm text-muted-foreground">
                No parcels match the current search and filters.
              </TableCell>
            </TableRow>
          ) : (
            parcels.map((parcel) => (
              <TableRow key={parcel.id}>
                <TableCell>
                  <Checkbox aria-label={`Select ${parcel.parcelCode}`} />
                </TableCell>
                <TableCell className="font-medium">{parcel.parcelCode}</TableCell>
                <TableCell>{parcel.merchantName}</TableCell>
                <TableCell>
                  <div className="font-medium">{parcel.receiverName}</div>
                  <div className="text-xs text-muted-foreground">{parcel.receiverPhoneNumber}</div>
                </TableCell>
                <TableCell>{parcel.townshipName}</TableCell>
                <TableCell className="text-right">{formatMoney(parcel.codAmount)}</TableCell>
                <TableCell className="text-right">{formatMoney(parcel.deliveryFee)}</TableCell>
                <TableCell>{parcel.riderName ?? "-"}</TableCell>
                <TableCell>
                  <ParcelStatusBadge status={parcel.status} />
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
                        <DropdownMenuItem onSelect={() => onEdit?.(parcel)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem>View</DropdownMenuItem>
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
