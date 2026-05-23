"use client";

import { type ReactNode, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Landmark, ReceiptText, WalletCards } from "lucide-react";

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
import type { SettlementEligibleMerchantDto } from "@/features/settlements/server/dto";
import { createMerchantSettlementAction } from "@/features/settlements/server/actions";
import { formatDate, formatMoney } from "@/lib/format";

type MerchantSettlementWorkspaceProps = Readonly<{
  merchants: SettlementEligibleMerchantDto[];
}>;

export function MerchantSettlementWorkspace({ merchants }: MerchantSettlementWorkspaceProps) {
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const selectedMerchant =
    merchants.find((merchant) => merchant.merchantId === selectedMerchantId) ?? null;

  return (
    <Tabs defaultValue="merchant-settlements" className="space-y-4 gap-0">
      <div className="flex items-center justify-between">
        <TabsList className="rounded-lg border border-border bg-[#f3f2ef] p-1">
          <TabsTrigger
            value="merchant-settlements"
            className="rounded-md border-0 px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-foreground"
          >
            Merchant Settlements
          </TabsTrigger>
          <TabsTrigger value="rider-payouts" disabled className="border-0">
            Rider Payouts
          </TabsTrigger>
        </TabsList>
        <p className="text-sm text-muted-foreground hidden">
          Rider payouts will be added in a later change.
        </p>
      </div>

      <TabsContent value="merchant-settlements">
        <div className="rounded-lg border bg-white">
          <div>
            {merchants.length === 0 ? (
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
                  {merchants.map((merchant) => (
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
                          onClick={() => setSelectedMerchantId(merchant.merchantId)}
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

      <Sheet
        open={selectedMerchant !== null}
        onOpenChange={(open) => !open && setSelectedMerchantId(null)}
      >
        <SheetContent className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[780px] data-[side=right]:sm:max-w-[780px]">
          {selectedMerchant ? (
            <MerchantSettlementSheet
              key={selectedMerchant.merchantId}
              merchant={selectedMerchant}
              onClose={() => setSelectedMerchantId(null)}
            />
          ) : null}
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
  const router = useRouter();
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
