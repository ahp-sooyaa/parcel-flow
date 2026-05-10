"use client";

import { CalendarDays, FileText, MapPin, Package2, Truck } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import { parcelStatusLabels } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";

function DetailRow({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function StatCard({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="rounded-xl border border-[#e7dfd8] bg-[#fcfbf8] p-4">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function ParcelDetailSheet({ parcel }: Readonly<{ parcel: ParcelListItemDto }>) {
  const parcelType = parcel.codAmount > 0 ? "COD" : "Non-COD";
  const amountToCollect = parcel.codAmount + parcel.deliveryFee;
  const statusVariant = parcel.status === "delivered" ? "success" : parcel.status === "at_office" ? "secondary" : "warning";

  return (
    <div className="flex h-full flex-col bg-[#fcfbf8] text-[#292827]">
      <SheetHeader className="space-y-3 border-b border-[#e7dfd8] p-6 pb-4 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <SheetTitle className="text-[2rem] font-semibold tracking-[-0.04em]">Parcel Detail</SheetTitle>
            <SheetDescription className="max-w-lg text-sm leading-6">
              Review parcel overview, receiver information, and collection amounts from the listing.
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <Card className="gap-0 border-[#e7dfd8] bg-white shadow-[0_20px_50px_rgba(27,25,56,0.06)]">
          <CardHeader className="border-b border-[#f0e7df]">
            <CardTitle className="flex items-start justify-between gap-2 text-base">
              <div className="flex items-start gap-2">
                <Package2 className="mt-1 size-4 text-muted-foreground" />
                <div className="flex flex-col space-y-1">
                  <span className="text-sm text-muted-foreground">Parcel ID</span>
                  <p className="font-mono text-base">{parcel.parcelCode}</p>
                </div>
              </div>
              <StatusBadge label={parcelStatusLabels[parcel.status]} variant={statusVariant} />
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-5 pt-6">
            <dl className="space-y-4">
              <DetailRow label="Merchant" value={parcel.merchantName} />
              <DetailRow label="Receiver Name" value={parcel.receiverName} />
              <DetailRow label="Receiver Phone" value={parcel.receiverPhoneNumber} />
              <DetailRow label="Township" value={parcel.townshipName} />
              <DetailRow label="Parcel Type" value={parcelType} />
            </dl>
          </CardContent>

          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="COD Amount" value={`${formatMoney(parcel.codAmount)} MMK`} />
              <StatCard label="Delivery Fee" value={`${formatMoney(parcel.deliveryFee)} MMK`} />
              <StatCard label="Total Collect" value={`${formatMoney(amountToCollect)} MMK`} />
            </div>

            <Separator className="my-5" />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="col-span-2 rounded-xl border border-[#e7dfd8] bg-[#fcfbf8] px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <MapPin className="size-3.5" />
                  Address
                </div>
                <div className="mt-2 font-medium text-foreground">{parcel.receiverAddress ?? "-"}</div>
              </div>
              <div className="col-span-2 rounded-xl border border-[#e7dfd8] bg-[#fcfbf8] px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <FileText className="size-3.5" />
                  Special Note
                </div>
                <div className="mt-2 font-medium text-foreground">{parcel.specialNotes ?? "-"}</div>
              </div>
              <div className="rounded-xl border border-[#e7dfd8] bg-[#fcfbf8] px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <Truck className="size-3.5" />
                  Rider
                </div>
                <div className="mt-2 font-medium text-foreground">{parcel.riderName ?? "Not assigned yet"}</div>
              </div>
              <div className="rounded-xl border border-[#e7dfd8] bg-[#fcfbf8] px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  Intake Date
                </div>
                <div className="mt-2 font-medium text-foreground">{formatDate(parcel.createdAt)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
