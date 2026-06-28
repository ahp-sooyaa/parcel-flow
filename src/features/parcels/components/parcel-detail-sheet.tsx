"use client";

import { useEffect, useId, useState, useTransition } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  CalendarDays,
  Camera,
  FileText,
  History,
  MapPin,
  Package2,
  RotateCcw,
  Truck,
} from "lucide-react";

import { FormBanner, inputClassName, textareaClassName } from "@/components/shared/form-fields";
import type { FormMessageState } from "@/components/shared/form-fields";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  correctParcelRiderAction,
  correctParcelStatusAction,
} from "@/features/parcels/server/actions";
import type { ParcelListItemDto } from "@/features/parcels/server/dto";
import type { RiderListItemDto } from "@/features/riders/server/dto";
import type { UserRole } from "@/lib/domain";
import { parcelStatuses, parcelStatusLabels } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";

const unassignedRiderValue = "__unassigned__";
const correctionWarningText =
  "Review the current parcel, rider, and financial state before saving because linked records may also be adjusted or block the correction.";

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
      <div className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function ParcelDetailSheet({
  actorRole,
  parcel,
  riders = [],
}: Readonly<{
  actorRole: UserRole;
  parcel: ParcelListItemDto;
  riders?: RiderListItemDto[];
}>) {
  const parcelType = parcel.codAmount > 0 ? "COD" : "Non-COD";
  const amountToCollect = parcel.codAmount + parcel.deliveryFee;
  let statusVariant: "success" | "secondary" | "warning" = "warning";

  if (parcel.status === "delivered") {
    statusVariant = "success";
  } else if (parcel.status === "at_office") {
    statusVariant = "secondary";
  }

  return (
    <div className="flex h-full flex-col bg-[#fcfbf8] text-[#292827]">
      <SheetHeader className="space-y-3 border-b border-[#e7dfd8] p-6 pb-4 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <SheetTitle className="text-[2rem] font-semibold tracking-[-0.04em]">
              Parcel Detail
            </SheetTitle>
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
              {actorRole !== "rider" ? (
                <DetailRow label="Merchant" value={parcel.merchantName} />
              ) : null}
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
                <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  <MapPin className="size-3.5" />
                  Address
                </div>
                <div className="mt-2 font-medium text-foreground">
                  {parcel.receiverAddress ?? "-"}
                </div>
              </div>
              <div className="col-span-2 rounded-xl border border-[#e7dfd8] bg-[#fcfbf8] px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  <FileText className="size-3.5" />
                  Special Note
                </div>
                <div className="mt-2 font-medium text-foreground">{parcel.specialNotes ?? "-"}</div>
              </div>
              <div className="rounded-xl border border-[#e7dfd8] bg-[#fcfbf8] px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  <Truck className="size-3.5" />
                  Rider
                </div>
                <div className="mt-2 font-medium text-foreground">
                  {parcel.riderName ?? "Not assigned yet"}
                </div>
              </div>
              <div className="rounded-xl border border-[#e7dfd8] bg-[#fcfbf8] px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  <CalendarDays className="size-3.5" />
                  Intake Date
                </div>
                <div className="mt-2 font-medium text-foreground">
                  {formatDate(parcel.createdAt)}
                </div>
              </div>
            </div>
          </CardContent>

          {actorRole === "super_admin" || actorRole === "office_admin" ? (
            <CardContent className="pt-2 pb-6">
              <Separator className="mt-4 mb-5" />
              <ParcelCorrectionsSection parcel={parcel} riders={riders} />
            </CardContent>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function ParcelCorrectionsSection({
  parcel,
  riders,
}: Readonly<{
  parcel: ParcelListItemDto;
  riders: RiderListItemDto[];
}>) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [riderDialogOpen, setRiderDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <RotateCcw className="size-4 text-muted-foreground" />
            Corrections
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin overrides are audited with reason and side-effect details.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => setStatusDialogOpen(true)}>
            Correct Status
          </Button>
          <Button type="button" variant="outline" onClick={() => setRiderDialogOpen(true)}>
            Correct Rider
          </Button>
        </div>
      </div>

      <CorrectionHistory parcel={parcel} />

      <CorrectStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        parcel={parcel}
        riders={riders}
      />
      <CorrectRiderDialog
        open={riderDialogOpen}
        onOpenChange={setRiderDialogOpen}
        parcel={parcel}
        riders={riders}
      />
    </div>
  );
}

function CorrectionHistory({ parcel }: Readonly<{ parcel: ParcelListItemDto }>) {
  const recentLogs = parcel.correctionLogs.slice(0, 5);

  return (
    <div className="rounded-xl border border-[#e7dfd8] bg-[#fcfbf8] px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        <History className="size-3.5" />
        Recent Corrections
      </div>
      {recentLogs.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No corrections recorded.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {recentLogs.map((log) => (
            <div key={log.id} className="rounded-lg border bg-white px-3 py-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-medium text-foreground">
                  {log.correctionType === "status"
                    ? `${log.oldStatus ? parcelStatusLabels[log.oldStatus] : "-"} -> ${
                        log.newStatus ? parcelStatusLabels[log.newStatus] : "-"
                      }`
                    : `${log.oldRiderName ?? "Unassigned"} -> ${log.newRiderName ?? "Unassigned"}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(log.createdAt)}
                  {log.createdByName ? ` by ${log.createdByName}` : ""}
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{log.reason}</p>
              {log.sideEffects.summary.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {log.sideEffects.summary.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CorrectStatusDialog({
  open,
  onOpenChange,
  parcel,
  riders,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parcel: ParcelListItemDto;
  riders: RiderListItemDto[];
}>) {
  const statusInputId = useId();
  const riderInputId = useId();
  const proofInputId = useId();
  const reasonInputId = useId();
  const [isPending, startTransition] = useTransition();
  const [targetStatus, setTargetStatus] = useState(parcel.status);
  const [targetRiderValue, setTargetRiderValue] = useState(parcel.riderId ?? unassignedRiderValue);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const canSelectRider =
    targetStatus === "on_the_way" ||
    targetStatus === "delivered" ||
    targetStatus === "returned_to_merchant" ||
    targetStatus === "canceled_returned";
  const submittedTargetRiderId = canSelectRider ? readRiderValue(targetRiderValue) : null;
  const hasStatusCorrectionChange = targetStatus !== parcel.status;

  useEffect(() => {
    if (!open) {
      return;
    }

    setTargetStatus(parcel.status);
    setTargetRiderValue(parcel.riderId ?? unassignedRiderValue);
    setProofImage(null);
    setProofPreviewUrl(null);
    setReason("");
    setSubmissionState(null);
  }, [open, parcel.id, parcel.riderId, parcel.status]);

  useEffect(() => {
    if (!proofPreviewUrl) {
      return undefined;
    }

    return () => {
      URL.revokeObjectURL(proofPreviewUrl);
    };
  }, [proofPreviewUrl]);

  function handleTargetStatusChange(nextStatus: ParcelListItemDto["status"]) {
    setTargetStatus(nextStatus);

    if (nextStatus !== "delivered") {
      setProofImage(null);
      setProofPreviewUrl(null);
    }

    if (
      nextStatus === "at_office" ||
      nextStatus === "postpone" ||
      nextStatus === "canceled_returned"
    ) {
      setTargetRiderValue(unassignedRiderValue);
      return;
    }

    if (
      (nextStatus === "on_the_way" || nextStatus === "delivered") &&
      targetRiderValue === unassignedRiderValue &&
      riders[0]
    ) {
      setTargetRiderValue(riders[0].id);
    }
  }

  function handleProofImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setProofImage(file);
    setProofPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function submitCorrection() {
    setSubmissionState(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("parcelId", parcel.id);
      formData.set("expectedStatus", parcel.status);
      formData.set("expectedRiderId", parcel.riderId ?? "");
      formData.set("expectedFinancialItemsFingerprint", parcel.correctionStateToken);
      formData.set("targetStatus", targetStatus);
      formData.set("targetRiderId", submittedTargetRiderId ?? "");
      formData.set("reason", reason);

      if (targetStatus === "delivered" && proofImage) {
        formData.set("proofImage", proofImage);
      }

      const result = await correctParcelStatusAction(formData);

      if (!result.ok) {
        setSubmissionState({ kind: "error", message: result.message });
        return;
      }

      setSubmissionState({ kind: "success", message: result.message });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Correct Status</DialogTitle>
          <DialogDescription>{parcel.parcelCode}</DialogDescription>
        </DialogHeader>

        {submissionState ? <FormBanner state={submissionState} /> : null}

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor={statusInputId}>Target status</Label>
            <Select
              value={targetStatus}
              onValueChange={(nextStatus) => {
                if (nextStatus) {
                  handleTargetStatusChange(nextStatus);
                }
              }}
            >
              <SelectTrigger id={statusInputId} className={inputClassName}>
                <span>{parcelStatusLabels[targetStatus]}</span>
              </SelectTrigger>
              <SelectContent>
                {parcelStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {parcelStatusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canSelectRider ? (
            <RiderSelectField
              id={riderInputId}
              label="Rider"
              value={targetRiderValue}
              onChange={setTargetRiderValue}
              riders={riders}
              allowUnassigned={
                targetStatus === "canceled_returned" || targetStatus === "returned_to_merchant"
              }
            />
          ) : null}

          {targetStatus === "delivered" ? (
            <div className="space-y-3">
              <Label htmlFor={proofInputId}>Delivery proof photo</Label>
              <input
                id={proofInputId}
                name="proofImage"
                type="file"
                accept="image/*"
                disabled={isPending}
                className="sr-only"
                onChange={handleProofImageChange}
              />
              <Label
                htmlFor={proofInputId}
                className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-white px-4 py-5 text-center transition-colors hover:bg-secondary/50"
              >
                <ProofUploadContent
                  file={proofImage}
                  previewUrl={proofPreviewUrl}
                  hasExistingProof={parcel.proofOfDeliveryImagesKeys.length > 0}
                />
              </Label>
              <p className="text-xs text-muted-foreground">
                Upload a JPG, PNG, or WebP image. Existing proof will be preserved if no new photo
                is selected.
              </p>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor={reasonInputId}>Reason</Label>
            <Textarea
              id={reasonInputId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={textareaClassName}
            />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {correctionWarningText}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !hasStatusCorrectionChange}
            onClick={submitCorrection}
          >
            {isPending ? "Correcting..." : "Correct Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CorrectRiderDialog({
  open,
  onOpenChange,
  parcel,
  riders,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parcel: ParcelListItemDto;
  riders: RiderListItemDto[];
}>) {
  const riderInputId = useId();
  const reasonInputId = useId();
  const [isPending, startTransition] = useTransition();
  const [targetRiderValue, setTargetRiderValue] = useState(parcel.riderId ?? unassignedRiderValue);
  const [reason, setReason] = useState("");
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const targetRiderId = readRiderValue(targetRiderValue);
  const hasRiderCorrectionChange = targetRiderId !== (parcel.riderId ?? null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTargetRiderValue(parcel.riderId ?? unassignedRiderValue);
    setReason("");
    setSubmissionState(null);
  }, [open, parcel.id, parcel.riderId]);

  function submitCorrection() {
    setSubmissionState(null);
    startTransition(async () => {
      const result = await correctParcelRiderAction({
        parcelId: parcel.id,
        expectedStatus: parcel.status,
        expectedRiderId: parcel.riderId,
        expectedFinancialItemsFingerprint: parcel.correctionStateToken,
        targetRiderId,
        reason,
      });

      if (!result.ok) {
        setSubmissionState({ kind: "error", message: result.message });
        return;
      }

      setSubmissionState({ kind: "success", message: result.message });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Correct Rider</DialogTitle>
          <DialogDescription>{parcel.parcelCode}</DialogDescription>
        </DialogHeader>

        {submissionState ? <FormBanner state={submissionState} /> : null}

        <div className="space-y-4">
          <RiderSelectField
            id={riderInputId}
            label="Target rider"
            value={targetRiderValue}
            onChange={setTargetRiderValue}
            riders={riders}
            allowUnassigned
          />

          <div className="grid gap-2">
            <Label htmlFor={reasonInputId}>Reason</Label>
            <Textarea
              id={reasonInputId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={textareaClassName}
            />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {correctionWarningText}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !hasRiderCorrectionChange}
            onClick={submitCorrection}
          >
            {isPending ? "Correcting..." : "Correct Rider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProofUploadContent({
  file,
  previewUrl,
  hasExistingProof,
}: Readonly<{
  file: File | null;
  previewUrl: string | null;
  hasExistingProof: boolean;
}>) {
  let content: ReactNode;

  if (previewUrl) {
    content = (
      <div
        role="img"
        aria-label="Delivery proof preview"
        className="h-56 w-full rounded-md bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${previewUrl})` }}
      />
    );
  } else if (file) {
    content = (
      <>
        <Camera className="size-8 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{file.name}</span>
      </>
    );
  } else {
    content = (
      <>
        <Camera className="size-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {hasExistingProof ? "Choose replacement proof photo" : "Choose delivery proof photo"}
        </span>
      </>
    );
  }

  return content;
}

function RiderSelectField({
  id,
  label,
  value,
  onChange,
  riders,
  allowUnassigned,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  riders: RiderListItemDto[];
  allowUnassigned: boolean;
}>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(nextValue) => nextValue && onChange(nextValue)}>
        <SelectTrigger id={id} className={inputClassName}>
          <span>{getRiderSelectLabel(value, riders)}</span>
        </SelectTrigger>
        <SelectContent>
          {allowUnassigned ? (
            <SelectItem value={unassignedRiderValue}>Unassigned</SelectItem>
          ) : null}
          {riders.map((rider) => (
            <SelectItem key={rider.id} value={rider.id}>
              {rider.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function readRiderValue(value: string) {
  return value === unassignedRiderValue ? null : value;
}

function getRiderSelectLabel(value: string, riders: RiderListItemDto[]) {
  if (value === unassignedRiderValue) {
    return "Unassigned";
  }

  return riders.find((rider) => rider.id === value)?.name ?? "Select rider";
}
