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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Township Details</DialogTitle>
            <DialogDescription>
              Review the delivery pricing configuration used by parcel creation.
            </DialogDescription>
          </DialogHeader>

          {viewingTownship ? (
            <div className="space-y-4">
              <DetailRow label="Township" value={viewingTownship.name} />
              <DetailRow
                label="Status"
                value={viewingTownship.isActive ? "Active" : "Inactive"}
              />
              <DetailRow label="Base fee" value={`${formatMoney(viewingTownship.baseFee)} MMK`} />
              <DetailRow label="Base weight" value={`${viewingTownship.baseWeightKg} kg`} />
              <DetailRow
                label="Extra weight fee"
                value={`${formatMoney(viewingTownship.extraWeightFee)} MMK`}
              />
              <DetailRow
                label="Extra weight unit"
                value={`${viewingTownship.extraWeightUnitKg} kg`}
              />
              <DetailRow
                label="Volumetric divisor"
                value={String(viewingTownship.volumetricDivisor)}
              />
              <DetailRow
                label="COD fee percent"
                value={`${viewingTownship.codFeePercent}%`}
              />
              <DetailRow
                label="Return fee percent"
                value={`${viewingTownship.returnFeePercent}%`}
              />
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

function DetailRow({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-right text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
