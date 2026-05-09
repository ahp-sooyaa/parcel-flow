import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ParcelStatusBadge } from "@/features/parcels/components/parcel-status-badge";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import { formatDate, formatMoney } from "@/lib/format";

export function ParcelTable({ parcels }: { parcels: ParcelListItemDto[] }) {
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {parcels.map((parcel) => (
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
