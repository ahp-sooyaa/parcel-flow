"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TownshipForm } from "@/features/townships/components/township-form";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { formatMoney } from "@/lib/format";

type TownshipManagementProps = Readonly<{
  townships: TownshipListItemDto[];
  canManagePricing: boolean;
}>;

export function TownshipManagement({ townships, canManagePricing }: TownshipManagementProps) {
  const [viewingTownship, setViewingTownship] = useState<TownshipListItemDto | null>(null);
  const [editingTownship, setEditingTownship] = useState<TownshipListItemDto | null>(null);

  return (
    <>
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Base Fee</TableHead>
              <TableHead className="text-right">Base Weight</TableHead>
              <TableHead className="text-right">Extra Weight Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {townships.map((township) => (
              <TableRow key={township.id}>
                <TableCell className="font-medium">{township.name}</TableCell>
                <TableCell className="text-right">{formatMoney(township.baseFee)} MMK</TableCell>
                <TableCell className="text-right">{township.baseWeightKg}kg</TableCell>
                <TableCell className="text-right">
                  {formatMoney(township.extraWeightFee)} MMK
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={township.isActive ? "Active" : "Inactive"}
                    variant={township.isActive ? "success" : "secondary"}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-md text-muted-foreground"
                        aria-label={`Open actions for ${township.name}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[9rem]">
                      {canManagePricing ? (
                        <DropdownMenuItem onClick={() => setEditingTownship(township)}>
                          Edit
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => setViewingTownship(township)}>
                        View
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={viewingTownship !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewingTownship(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Township Details</DialogTitle>
            <DialogDescription>
              Review the delivery pricing configuration used by parcel creation.
            </DialogDescription>
          </DialogHeader>

          {viewingTownship ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e7dfd8] bg-[#fcfbf8] px-4 py-3">
                <div>
                  <p className="text-sm text-[#73706d]">Township</p>
                  <p className="text-base font-semibold text-[#292827]">{viewingTownship.name}</p>
                </div>
                <StatusBadge
                  label={viewingTownship.isActive ? "Active" : "Inactive"}
                  variant={viewingTownship.isActive ? "success" : "secondary"}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailCard
                  label="Base fee"
                  value={`${formatMoney(viewingTownship.baseFee)} MMK`}
                />
                <DetailCard label="Base weight" value={`${viewingTownship.baseWeightKg} kg`} />
                <DetailCard
                  label="Extra weight fee"
                  value={`${formatMoney(viewingTownship.extraWeightFee)} MMK`}
                />
                <DetailCard
                  label="Extra weight unit"
                  value={`${viewingTownship.extraWeightUnitKg} kg`}
                />
                <DetailCard
                  label="Volumetric divisor"
                  value={String(viewingTownship.volumetricDivisor)}
                />
                <DetailCard label="COD fee percent" value={`${viewingTownship.codFeePercent}%`} />
                <DetailCard
                  label="Return fee percent"
                  value={`${viewingTownship.returnFeePercent}%`}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <Sheet
        open={editingTownship !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTownship(null);
          }
        }}
      >
        <SheetContent className="overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[720px] data-[side=right]:sm:max-w-[720px]">
          {editingTownship ? (
            <TownshipForm key={editingTownship.id} mode="edit" township={editingTownship} />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function DetailCard({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="rounded-xl border border-[#e7dfd8] bg-[#fcfbf8] px-4 py-3">
      <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
