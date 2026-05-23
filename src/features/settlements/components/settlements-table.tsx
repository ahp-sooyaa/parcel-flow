"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Camera, FileText } from "lucide-react";

import {
  FormBanner,
  type FormMessageState,
  textareaClassName,
} from "@/components/shared/form-fields";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { SettlementListItemDto } from "@/features/settlements/server/dto";
import { resolveMerchantSettlementAction } from "@/features/settlements/server/actions";
import { useAppRouter } from "@/lib/client-navigation";
import type { UserRole } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";

type SettlementsTableProps = Readonly<{
  settlements: SettlementListItemDto[];
  actorRole: UserRole;
}>;

export function SettlementsTable({ settlements, actorRole }: SettlementsTableProps) {
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);
  const selectedSettlement =
    settlements.find((settlement) => settlement.id === selectedSettlementId) ?? null;

  return (
    <>
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Primary Bank</TableHead>
              <TableHead className="text-right">COD</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net Payment</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[140px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {settlements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  No settlements.
                </TableCell>
              </TableRow>
            ) : (
              settlements.map((settlement) => (
                <TableRow key={settlement.id}>
                  <TableCell className="font-medium">{settlement.settlementCode}</TableCell>
                  <TableCell>{settlement.merchantName}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={getSettlementStatusLabel(settlement.status)}
                      variant={getSettlementStatusVariant(settlement.status)}
                    />
                  </TableCell>
                  <TableCell>
                    {settlement.bankAccountSummary ?? "No bank account on file"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(settlement.totalCodAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(settlement.totalDeliveryFeeDeduction)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(settlement.netPaymentAmount)} MMK
                  </TableCell>
                  <TableCell>{formatDate(settlement.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {actorRole === "super_admin" && settlement.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSettlementId(settlement.id)}
                      >
                        Resolve
                      </Button>
                    ) : settlement.status === "settled" ? (
                      <span className="text-sm text-muted-foreground">
                        Paid {formatDate(settlement.paidAt)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">No action</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={selectedSettlement !== null}
        onOpenChange={(open) => !open && setSelectedSettlementId(null)}
      >
        <SheetContent className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[640px] data-[side=right]:sm:max-w-[640px]">
          {selectedSettlement ? (
            <ResolveSettlementSheet
              key={selectedSettlement.id}
              settlement={selectedSettlement}
              onClose={() => setSelectedSettlementId(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ResolveSettlementSheet({
  settlement,
  onClose,
}: Readonly<{
  settlement: SettlementListItemDto;
  onClose: () => void;
}>) {
  const router = useAppRouter();
  const [isPending, startTransition] = useTransition();
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [paymentNote, setPaymentNote] = useState("");
  const receiptInputId = useId();

  useEffect(() => {
    if (!receiptFile || !receiptFile.type.startsWith("image/")) {
      setReceiptPreviewUrl(null);
      return undefined;
    }

    const previewUrl = URL.createObjectURL(receiptFile);
    setReceiptPreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [receiptFile]);

  function submitResolution() {
    if (!receiptFile) {
      setSubmissionState({
        kind: "error",
        message: "Bank transfer receipt is required.",
      });
      return;
    }

    setSubmissionState(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("settlementId", settlement.id);
      formData.set("paymentNote", paymentNote);
      formData.set("bankTransferReceipt", receiptFile);

      const result = await resolveMerchantSettlementAction(formData);

      if (!result.ok) {
        setSubmissionState({
          kind: "error",
          message: result.message,
        });
        return;
      }

      setSubmissionState({
        kind: "success",
        message: `${settlement.settlementCode} was marked as paid.`,
      });
      router.refresh();
      onClose();
    });
  }

  let receiptUploadContent: React.ReactNode;

  if (receiptPreviewUrl) {
    receiptUploadContent = (
      <div
        role="img"
        aria-label="Settlement receipt preview"
        className="h-56 w-full rounded-md bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${receiptPreviewUrl})` }}
      />
    );
  } else if (receiptFile) {
    receiptUploadContent = (
      <>
        <FileText className="size-8 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{receiptFile.name}</span>
      </>
    );
  } else {
    receiptUploadContent = (
      <>
        <Camera className="size-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Choose bank transfer receipt</span>
      </>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#fcfbf8] text-[#292827]">
      <SheetHeader className="border-b border-[#e7dfd8] p-6 pb-4 text-left">
        <SheetTitle className="text-[2rem] font-semibold tracking-[-0.04em]">
          Resolve Settlement
        </SheetTitle>
        <SheetDescription className="max-w-lg text-sm leading-6 text-[#73706d]">
          {settlement.settlementCode} · {settlement.merchantName}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
        {submissionState ? <FormBanner state={submissionState} /> : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <InfoCard label="Primary Bank" value={settlement.bankAccountSummary ?? "Missing"} />
          <InfoCard label="Net Payment" value={`${formatMoney(settlement.netPaymentAmount)} MMK`} />
          <InfoCard label="Status" value="Pending" />
        </div>

        <Card className="border-[#e7dfd8] bg-white py-4">
          <CardContent className="space-y-5 px-4">
            <div className="space-y-3">
              <Label htmlFor={receiptInputId}>Bank transfer receipt</Label>
              <input
                id={receiptInputId}
                name="bankTransferReceipt"
                type="file"
                accept=".pdf,image/*"
                disabled={isPending}
                className="sr-only"
                onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
              />
              <Label
                htmlFor={receiptInputId}
                className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-white px-4 py-5 text-center transition-colors hover:bg-secondary/50"
              >
                {receiptUploadContent}
              </Label>
              <p className="text-xs text-muted-foreground">
                Upload the transfer receipt as PDF, JPG, PNG, or WebP. Maximum 8MB.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentNote">Payment note (optional)</Label>
              <Textarea
                id="paymentNote"
                value={paymentNote}
                onChange={(event) => setPaymentNote(event.target.value)}
                placeholder="Reference number, transfer note, or internal comment"
                className={textareaClassName}
                disabled={isPending}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <SheetFooter className="border-t border-[#e7dfd8] bg-white px-6 py-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={isPending} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={isPending || receiptFile === null} onClick={submitResolution}>
          {isPending ? "Resolving..." : "Mark as Paid"}
        </Button>
      </SheetFooter>
    </div>
  );
}

function InfoCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-xl border border-[#e7dfd8] bg-white p-4">
      <div className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

function getSettlementStatusLabel(status: SettlementListItemDto["status"]) {
  if (status === "pending") {
    return "Pending";
  }

  if (status === "settled") {
    return "Settled";
  }

  return "Void";
}

function getSettlementStatusVariant(status: SettlementListItemDto["status"]) {
  if (status === "settled") {
    return "success";
  }

  if (status === "void") {
    return "destructive";
  }

  return "warning";
}
