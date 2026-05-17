"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormBanner, type FormMessageState } from "@/components/shared/form-fields";
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
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import { assignParcelsToRiderAction } from "@/features/parcels/server/actions";
import type { RiderListItemDto } from "@/features/riders/server/dto";
import { formatMoney } from "@/lib/format";

type AssignRiderDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedParcels: ParcelListItemDto[];
  riders: RiderListItemDto[];
}>;

type RiderOption = {
  value: string;
  label: string;
  helper: string;
  expectedCollection: number;
};

export function AssignRiderDialog({
  open,
  onOpenChange,
  selectedParcels,
  riders,
}: AssignRiderDialogProps) {
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const riderInputId = useId();
  const [isPending, startTransition] = useTransition();
  const riderOptions = useMemo<RiderOption[]>(
    () =>
      riders.map((rider) => ({
        value: rider.id,
        label: rider.name,
        helper: `${rider.phoneNumber} • ${rider.serviceTownships.join(", ")}`,
        expectedCollection: rider.expectedCollection,
      })),
    [riders],
  );

  const { setValue, watch, reset } = useForm<{ selectedRider: RiderOption | null }>({
    defaultValues: { selectedRider: null },
  });
  const selectedRider = watch("selectedRider");
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);

  useEffect(() => {
    if (!open) {
      reset({ selectedRider: null });
      setSubmissionState(null);
    }
  }, [open, reset]);

  const totalCodAmount = selectedParcels.reduce((sum, parcel) => sum + parcel.codAmount, 0);
  const totalDeliveryFee = selectedParcels.reduce((sum, parcel) => sum + parcel.deliveryFee, 0);
  const totalExpectedCollection = totalCodAmount + totalDeliveryFee;
  const riderCurrentExpectedCollection = selectedRider?.expectedCollection ?? 0;
  const afterAssignmentExpectedCollection =
    riderCurrentExpectedCollection + totalExpectedCollection;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[680px] gap-5 p-0 sm:max-w-[680px]">
        <div ref={overlayContainerRef} className="space-y-5 p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl">Assign Rider</DialogTitle>
            <DialogDescription>
              Select a rider and review the cash collection summary for the currently selected
              parcels.
            </DialogDescription>
          </DialogHeader>

          {submissionState ? <FormBanner state={submissionState} /> : null}

          <div className="space-y-3">
            <label htmlFor={riderInputId} className="text-sm font-medium text-foreground">
              Rider
            </label>
            <Combobox
              items={riderOptions}
              value={selectedRider}
              onValueChange={(nextValue) => setValue("selectedRider", nextValue ?? null)}
              itemToStringLabel={(option) => `${option.label} ${option.helper}`}
              isItemEqualToValue={(item, value) => item.value === value.value}
            >
              <ComboboxInput
                id={riderInputId}
                aria-label="Search rider"
                placeholder="Search rider by name or phone number"
                showClear={selectedRider !== null}
                className="h-11 w-full rounded-md text-sm"
              />
              <ComboboxContent className="z-50" portalContainer={overlayContainerRef}>
                <ComboboxEmpty>No riders found.</ComboboxEmpty>
                <ComboboxCollection>
                  {(option: RiderOption) => (
                    <ComboboxItem key={option.value} value={option} className="py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.helper}</span>
                      </div>
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxContent>
            </Combobox>
          </div>

          <div className="grid gap-3 rounded-xl border bg-[#fcfbf8] p-4 sm:grid-cols-3">
            <SummaryMetric label="Selected parcels" value={String(selectedParcels.length)} />
            <SummaryMetric label="Total COD amount" value={`${formatMoney(totalCodAmount)} MMK`} />
            <SummaryMetric
              label="Total delivery fee"
              value={`${formatMoney(totalDeliveryFee)} MMK`}
            />
            <SummaryMetric
              label="Total expected collection"
              value={`${formatMoney(totalExpectedCollection)} MMK`}
            />
            <SummaryMetric
              label="Rider current expected"
              value={`${formatMoney(riderCurrentExpectedCollection)} MMK`}
            />
            <SummaryMetric
              label="After assignment"
              value={`${formatMoney(afterAssignmentExpectedCollection)} MMK`}
              emphasized
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">Selected parcel summary</h3>
              <span className="text-xs text-muted-foreground">
                Amount to collect = COD + delivery fee
              </span>
            </div>

            <div className="max-h-[240px] overflow-y-auto rounded-xl border">
              <div className="divide-y">
                {selectedParcels.map((parcel) => (
                  <div
                    key={parcel.id}
                    className="grid gap-3 px-4 py-3 sm:grid-cols-[1.3fr_1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{parcel.parcelCode}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {parcel.receiverName} • {parcel.receiverPhoneNumber}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div>{parcel.merchantName}</div>
                      <div>{parcel.townshipName}</div>
                    </div>
                    <div className="text-left text-sm font-medium text-foreground sm:text-right">
                      {formatMoney(parcel.codAmount + parcel.deliveryFee)} MMK
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t px-0 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={selectedRider === null || isPending}
              onClick={() => {
                if (!selectedRider) {
                  return;
                }

                setSubmissionState(null);
                startTransition(async () => {
                  const result = await assignParcelsToRiderAction({
                    riderId: selectedRider.value,
                    parcelIds: selectedParcels.map((parcel) => parcel.id),
                  });

                  if (!result.ok) {
                    setSubmissionState({
                      kind: "error",
                      message: result.message,
                    });
                    return;
                  }

                  onOpenChange(false);
                });
              }}
            >
              {isPending ? "Assigning..." : "Assign Rider"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryMetric({
  label,
  value,
  emphasized = false,
}: Readonly<{
  label: string;
  value: string;
  emphasized?: boolean;
}>) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          emphasized ? "mt-2 text-base font-semibold text-foreground" : "mt-2 text-base font-medium"
        }
      >
        {value}
      </div>
    </div>
  );
}
