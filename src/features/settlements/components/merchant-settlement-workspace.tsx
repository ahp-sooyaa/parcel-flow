"use client";

import { type ReactNode, useMemo, useState, useTransition } from "react";
import { Landmark, Loader2, ReceiptText, Truck, WalletCards } from "lucide-react";

import { FormBanner, type FormMessageState } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  RiderCashHandoverListRowDto,
  RiderCashHandoverSummaryDto,
  SettlementEligibleMerchantDto,
  SettlementEligibleMerchantSummaryDto,
} from "@/features/settlements/server/dto";
import {
  confirmRiderCashHandoverAction,
  createMerchantSettlementAction,
  getEligibleSettlementMerchantDetailAction,
  getRiderCashHandoverDetailAction,
} from "@/features/settlements/server/actions";
import { useAppRouter } from "@/lib/client-navigation";
import { formatDate, formatMoney } from "@/lib/format";

type MerchantSettlementWorkspaceProps = Readonly<{
  merchantSummaries: SettlementEligibleMerchantSummaryDto[];
  riderHandoverSummaries: RiderCashHandoverSummaryDto[];
}>;

export function MerchantSettlementWorkspace({
  merchantSummaries,
  riderHandoverSummaries,
}: MerchantSettlementWorkspaceProps) {
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<SettlementEligibleMerchantDto | null>(
    null,
  );
  const [selectedRider, setSelectedRider] = useState<RiderCashHandoverListRowDto | null>(null);
  const [merchantDetailError, setMerchantDetailError] = useState<string | null>(null);
  const [riderDetailError, setRiderDetailError] = useState<string | null>(null);
  const [, startDetailTransition] = useTransition();

  function openMerchantReview(merchantId: string) {
    setSelectedMerchantId(merchantId);
    setSelectedMerchant(null);
    setMerchantDetailError(null);

    startDetailTransition(async () => {
      try {
        const merchant = await getEligibleSettlementMerchantDetailAction(merchantId);
        setSelectedMerchant(merchant);
      } catch (error) {
        setMerchantDetailError(
          error instanceof Error ? error.message : "Unable to load merchant settlement details.",
        );
      }
    });
  }

  function openRiderHandoverReview(riderId: string) {
    setSelectedRiderId(riderId);
    setSelectedRider(null);
    setRiderDetailError(null);

    startDetailTransition(async () => {
      try {
        const handover = await getRiderCashHandoverDetailAction(riderId);
        setSelectedRider(handover);
      } catch (error) {
        setRiderDetailError(
          error instanceof Error ? error.message : "Unable to load rider cash handover details.",
        );
      }
    });
  }

  function closeMerchantSheet() {
    setSelectedMerchantId(null);
    setSelectedMerchant(null);
    setMerchantDetailError(null);
  }

  function closeRiderSheet() {
    setSelectedRiderId(null);
    setSelectedRider(null);
    setRiderDetailError(null);
  }

  return (
    <Tabs defaultValue="merchant-settlements" className="gap-0 space-y-4">
      <div className="flex items-center justify-between">
        <TabsList className="rounded-lg border border-border bg-[#f3f2ef] p-1">
          <TabsTrigger
            value="merchant-settlements"
            className="rounded-md border-0 px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-foreground"
          >
            Merchant Settlements
          </TabsTrigger>
          <TabsTrigger
            value="rider-cash-handover"
            className="rounded-md border-0 px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-foreground"
          >
            Rider Cash Handover
          </TabsTrigger>
          <TabsTrigger value="rider-payouts" disabled className="border-0">
            Rider Payouts
          </TabsTrigger>
        </TabsList>
        <p className="hidden text-sm text-muted-foreground">
          Rider payouts will be added in a later change.
        </p>
      </div>

      <TabsContent value="merchant-settlements">
        <div className="rounded-lg border bg-white">
          <div>
            {merchantSummaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                <WalletCards className="size-10 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">
                    No merchants are ready for settlement.
                  </p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Primary Bank</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">COD</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Payment</TableHead>
                    <TableHead className="w-[120px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merchantSummaries.map((merchant) => (
                    <TableRow key={merchant.merchantId}>
                      <TableCell className="font-medium">{merchant.merchantName}</TableCell>
                      <TableCell>
                        {merchant.bankAccountSummary ?? "No bank account on file"}
                      </TableCell>
                      <TableCell className="text-right">{merchant.eligibleItemCount}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(merchant.totalCodAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(merchant.totalDeliveryFeeDeduction)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(merchant.netPaymentAmount)} MMK
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openMerchantReview(merchant.merchantId)}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="rider-cash-handover">
        <div className="rounded-lg border bg-white">
          <div>
            {riderHandoverSummaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                <Truck className="size-10 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">
                    No rider cash handovers are pending.
                  </p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rider</TableHead>
                    <TableHead className="text-right">Parcels</TableHead>
                    <TableHead className="text-right">Delivery Fees</TableHead>
                    <TableHead className="text-right">COD</TableHead>
                    <TableHead className="text-right">Total Handover</TableHead>
                    <TableHead className="w-[160px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riderHandoverSummaries.map((handover) => (
                    <TableRow key={handover.riderId}>
                      <TableCell className="font-medium">{handover.riderName}</TableCell>
                      <TableCell className="text-right">{handover.pendingParcelCount}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(handover.totalDeliveryFeeAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(handover.totalCodAmount)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(handover.totalCollectedAmount)} MMK
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRiderHandoverReview(handover.riderId)}
                        >
                          Confirm Handover
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </TabsContent>

      <Sheet
        open={selectedMerchantId !== null}
        onOpenChange={(open) => !open && closeMerchantSheet()}
      >
        <SheetContent className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[780px] data-[side=right]:sm:max-w-[780px]">
          {merchantDetailError ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-destructive">
              {merchantDetailError}
            </div>
          ) : selectedMerchant ? (
            <MerchantSettlementSheet
              key={selectedMerchant.merchantId}
              merchant={selectedMerchant}
              onClose={closeMerchantSheet}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={selectedRiderId !== null} onOpenChange={(open) => !open && closeRiderSheet()}>
        <SheetContent className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[820px] data-[side=right]:sm:max-w-[820px]">
          {riderDetailError ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-destructive">
              {riderDetailError}
            </div>
          ) : selectedRider ? (
            <RiderCashHandoverSheet
              key={selectedRider.riderId}
              riderHandover={selectedRider}
              onClose={closeRiderSheet}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Tabs>
  );
}

function MerchantSettlementSheet({
  merchant,
  onClose,
}: Readonly<{
  merchant: SettlementEligibleMerchantDto;
  onClose: () => void;
}>) {
  const router = useAppRouter();
  const [isPending, startTransition] = useTransition();
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    merchant.financialItems.map((item) => item.id),
  );

  const selectedItems = useMemo(
    () => merchant.financialItems.filter((item) => selectedIds.includes(item.id)),
    [merchant.financialItems, selectedIds],
  );
  const totals = useMemo(
    () =>
      selectedItems.reduce(
        (summary, item) => ({
          totalCodAmount:
            summary.totalCodAmount + (item.itemType === "cod_remit" ? item.amount : 0),
          totalDeliveryFeeDeduction:
            summary.totalDeliveryFeeDeduction +
            (item.itemType === "delivery_fee_deduction" ? item.amount : 0),
        }),
        { totalCodAmount: 0, totalDeliveryFeeDeduction: 0 },
      ),
    [selectedItems],
  );
  const netPaymentAmount = totals.totalCodAmount - totals.totalDeliveryFeeDeduction;
  const hasSelectedItems = selectedIds.length > 0;
  const hasInvalidNegativeSelection =
    hasSelectedItems && (totals.totalCodAmount <= 0 || netPaymentAmount < 0);
  const allVisibleSelected =
    merchant.financialItems.length > 0 &&
    merchant.financialItems.every((item) => selectedIds.includes(item.id));
  const someVisibleSelected = merchant.financialItems.some((item) => selectedIds.includes(item.id));

  function toggleItem(itemId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(itemId) ? current : [...current, itemId];
      }

      return current.filter((id) => id !== itemId);
    });
  }

  function toggleAllItems(checked: boolean) {
    if (checked) {
      setSelectedIds(merchant.financialItems.map((item) => item.id));
      return;
    }

    setSelectedIds([]);
  }

  function submitSettlement() {
    setSubmissionState(null);

    startTransition(async () => {
      const result = await createMerchantSettlementAction({
        merchantId: merchant.merchantId,
        financialItemIds: selectedIds,
      });

      if (!result.ok) {
        setSubmissionState({
          kind: "error",
          message: result.message,
        });
        return;
      }

      setSubmissionState({
        kind: "success",
        message: `${result.settlement.settlementCode} is ready for super admin resolution.`,
      });
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="flex h-full flex-col bg-[#fcfbf8] text-[#292827]">
      <SheetHeader className="border-b border-[#e7dfd8] p-6 pb-4 text-left">
        <SheetTitle className="text-[2rem] font-semibold tracking-[-0.04em]">
          Generate Settlement
        </SheetTitle>
        <SheetDescription className="max-w-xl text-sm leading-6 text-[#73706d]">
          {merchant.merchantName} has {merchant.eligibleItemCount} eligible financial items ready
          for settlement.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
        {submissionState ? <FormBanner state={submissionState} /> : null}
        {hasInvalidNegativeSelection ? (
          <FormBanner
            state={{
              kind: "error",
              message: "Delivery fee deductions exceed the selected COD amount.",
              detail: "Add more COD remit items or remove some delivery fee deductions.",
            }}
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={<ReceiptText className="size-4" />}
            label="Primary Bank"
            value={merchant.bankAccountSummary ?? "Missing"}
          />
          <SummaryCard
            icon={<WalletCards className="size-4" />}
            label="Selected Items"
            value={String(selectedItems.length)}
          />
          <SummaryCard
            icon={<Landmark className="size-4" />}
            label="Net Payment"
            value={`${formatMoney(netPaymentAmount)} MMK`}
          />
        </div>

        <div className="rounded-lg border bg-white">
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      aria-label="Select all settlement items"
                      checked={allVisibleSelected}
                      indeterminate={!allVisibleSelected && someVisibleSelected}
                      disabled={isPending || merchant.financialItems.length === 0}
                      onCheckedChange={toggleAllItems}
                      className="rounded-[6px] shadow-sm"
                    />
                  </TableHead>
                  <TableHead>Parcel</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchant.financialItems.map((item) => {
                  const checked = selectedIds.includes(item.id);

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          aria-label={`Select settlement item for ${item.parcelCode ?? "unlinked parcel"}`}
                          disabled={isPending}
                          onCheckedChange={(nextChecked) => toggleItem(item.id, nextChecked)}
                          className="rounded-[6px] shadow-sm"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.parcelCode ?? "Unlinked parcel"}
                      </TableCell>
                      <TableCell>
                        {item.itemType === "cod_remit" ? "COD Remit" : "Delivery Fee Deduction"}
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(item.amount)}</TableCell>
                      <TableCell>{formatDate(item.createdAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Total COD" value={`${formatMoney(totals.totalCodAmount)} MMK`} />
            <Metric
              label="Total Deductions"
              value={`${formatMoney(totals.totalDeliveryFeeDeduction)} MMK`}
            />
            <Metric label="Net Payment" value={`${formatMoney(netPaymentAmount)} MMK`} />
          </div>
        </div>
      </div>

      <SheetFooter className="border-t border-[#e7dfd8] bg-white px-6 py-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={isPending} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={isPending || !hasSelectedItems || hasInvalidNegativeSelection}
          onClick={submitSettlement}
        >
          {isPending ? "Generating..." : "Generate Settlement"}
        </Button>
      </SheetFooter>
    </div>
  );
}

function RiderCashHandoverSheet({
  riderHandover,
  onClose,
}: Readonly<{
  riderHandover: RiderCashHandoverListRowDto;
  onClose: () => void;
}>) {
  const router = useAppRouter();
  const [isPending, startTransition] = useTransition();
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    riderHandover.parcels.map((parcel) => parcel.id),
  );

  const selectedParcels = useMemo(
    () => riderHandover.parcels.filter((parcel) => selectedIds.includes(parcel.id)),
    [riderHandover.parcels, selectedIds],
  );
  const totals = useMemo(
    () =>
      selectedParcels.reduce(
        (summary, parcel) => ({
          totalCodAmount:
            summary.totalCodAmount + (parcel.parcelType === "cod" ? parcel.codAmount : 0),
          totalDeliveryFeeAmount: summary.totalDeliveryFeeAmount + parcel.deliveryFee,
          totalCollectedAmount: summary.totalCollectedAmount + parcel.collectedAmount,
        }),
        { totalCodAmount: 0, totalDeliveryFeeAmount: 0, totalCollectedAmount: 0 },
      ),
    [selectedParcels],
  );
  const hasSelectedParcels = selectedIds.length > 0;
  const allVisibleSelected =
    riderHandover.parcels.length > 0 &&
    riderHandover.parcels.every((parcel) => selectedIds.includes(parcel.id));
  const someVisibleSelected = riderHandover.parcels.some((parcel) =>
    selectedIds.includes(parcel.id),
  );

  function toggleParcel(parcelId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(parcelId) ? current : [...current, parcelId];
      }

      return current.filter((id) => id !== parcelId);
    });
  }

  function toggleAllParcels(checked: boolean) {
    if (checked) {
      setSelectedIds(riderHandover.parcels.map((parcel) => parcel.id));
      return;
    }

    setSelectedIds([]);
  }

  function submitHandover() {
    setSubmissionState(null);

    startTransition(async () => {
      const result = await confirmRiderCashHandoverAction({
        riderId: riderHandover.riderId,
        parcelIds: selectedIds,
      });

      if (!result.ok) {
        setSubmissionState({
          kind: "error",
          message: result.message,
        });
        return;
      }

      setSubmissionState({
        kind: "success",
        message: `${result.result.confirmedParcelCount} parcel handover confirmed for ${riderHandover.riderName}.`,
      });
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="flex h-full flex-col bg-[#fcfbf8] text-[#292827]">
      <SheetHeader className="border-b border-[#e7dfd8] p-6 pb-4 text-left">
        <SheetTitle className="text-[2rem] font-semibold tracking-[-0.04em]">
          Confirm Rider Handover
        </SheetTitle>
        <SheetDescription className="max-w-xl text-sm leading-6 text-[#73706d]">
          Review delivered parcels still waiting for office receipt confirmation from{" "}
          {riderHandover.riderName}.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
        {submissionState ? <FormBanner state={submissionState} /> : null}
        {!hasSelectedParcels ? (
          <FormBanner
            state={{
              kind: "error",
              message: "Select at least one parcel.",
            }}
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={<Truck className="size-4" />}
            label="Selected Parcels"
            value={String(selectedParcels.length)}
          />
          <SummaryCard
            icon={<ReceiptText className="size-4" />}
            label="Collected COD"
            value={`${formatMoney(totals.totalCodAmount)} MMK`}
          />
          <SummaryCard
            icon={<WalletCards className="size-4" />}
            label="Total Handover"
            value={`${formatMoney(totals.totalCollectedAmount)} MMK`}
          />
        </div>

        {riderHandover.parcels.length === 0 ? (
          <div className="rounded-lg border bg-white px-6 py-14 text-center text-sm text-muted-foreground">
            No eligible parcels remain for this rider.
          </div>
        ) : (
          <div className="rounded-lg border bg-white">
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        aria-label="Select all rider handover parcels"
                        checked={allVisibleSelected}
                        indeterminate={!allVisibleSelected && someVisibleSelected}
                        disabled={isPending}
                        onCheckedChange={toggleAllParcels}
                        className="rounded-[6px] shadow-sm"
                      />
                    </TableHead>
                    <TableHead>Parcel</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Delivery Fee</TableHead>
                    <TableHead className="text-right">COD</TableHead>
                    <TableHead className="text-right">Collected</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riderHandover.parcels.map((parcel) => {
                    const checked = selectedIds.includes(parcel.id);

                    return (
                      <TableRow key={parcel.id}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            aria-label={`Select parcel ${parcel.parcelCode}`}
                            disabled={isPending}
                            onCheckedChange={(nextChecked) => toggleParcel(parcel.id, nextChecked)}
                            className="rounded-[6px] shadow-sm"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{parcel.parcelCode}</TableCell>
                        <TableCell>{parcel.merchantName}</TableCell>
                        <TableCell>{parcel.parcelType === "cod" ? "COD" : "Non-COD"}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(parcel.deliveryFee)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(parcel.codAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(parcel.collectedAmount)}
                        </TableCell>
                        <TableCell>{formatDate(parcel.deliveredAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="rounded-lg border bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Delivery Fees"
              value={`${formatMoney(totals.totalDeliveryFeeAmount)} MMK`}
            />
            <Metric label="COD" value={`${formatMoney(totals.totalCodAmount)} MMK`} />
            <Metric
              label="Total Handover"
              value={`${formatMoney(totals.totalCollectedAmount)} MMK`}
            />
          </div>
        </div>
      </div>

      <SheetFooter className="border-t border-[#e7dfd8] bg-white px-6 py-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={isPending} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={isPending || !hasSelectedParcels} onClick={submitHandover}>
          {isPending ? "Confirming..." : "Confirm Handover"}
        </Button>
      </SheetFooter>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: Readonly<{
  icon: ReactNode;
  label: string;
  value: string;
}>) {
  return (
    <div className="rounded-lg border bg-white px-4 py-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground sm:text-base">{value}</div>
    </div>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}
