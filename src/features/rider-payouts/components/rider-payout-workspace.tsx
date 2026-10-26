"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Plus, WalletCards } from "lucide-react";

import { PaginationControls } from "@/components/shared/pagination-controls";
import {
  FieldShell,
  FormBanner,
  type FormMessageState,
  inputClassName,
} from "@/components/shared/form-fields";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
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
import {
  cancelRiderPayoutDraftAction,
  createRiderPayoutDraftAction,
  getEligibleRiderPayoutRiderDetailAction,
  listEligibleRiderPayoutRiderSummariesAction,
  settleRiderPayoutAction,
} from "@/features/rider-payouts/server/actions";
import type {
  RiderPayoutEligibleFinancialItemDto,
  RiderPayoutEligibleRiderSummaryDto,
  RiderPayoutListFiltersDto,
  RiderPayoutListItemDto,
  RiderPayoutListPageDto,
} from "@/features/rider-payouts/server/dto";
import { useAppRouter } from "@/lib/client-navigation";
import type { RiderWaySource, UserRole } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { canSettleRiderPayout } from "@/lib/permissions";

type RiderPayoutWorkspaceProps = Readonly<{
  pageResult: RiderPayoutListPageDto;
  filters: RiderPayoutListFiltersDto;
  actorRole: UserRole;
}>;

type RiderPayoutCreateActionProps = Readonly<{
  initialEligibleRiderSummaries?: RiderPayoutEligibleRiderSummaryDto[];
}>;

export function RiderPayoutCreateAction({
  initialEligibleRiderSummaries = [],
}: RiderPayoutCreateActionProps) {
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [eligibleRiderSummaries, setEligibleRiderSummaries] = useState(
    initialEligibleRiderSummaries,
  );
  const [isLoadingEligibleRiders, setIsLoadingEligibleRiders] = useState(false);
  const [eligibleRidersError, setEligibleRidersError] = useState<string | null>(null);

  async function handleOpenChange(open: boolean) {
    setCreateSheetOpen(open);

    if (!open || eligibleRiderSummaries.length > 0 || isLoadingEligibleRiders) {
      return;
    }

    setEligibleRidersError(null);
    setIsLoadingEligibleRiders(true);

    try {
      const result = await listEligibleRiderPayoutRiderSummariesAction();

      if (!result.ok) {
        setEligibleRidersError(result.message);
        return;
      }

      setEligibleRiderSummaries(result.riders);
    } finally {
      setIsLoadingEligibleRiders(false);
    }
  }

  return (
    <Sheet open={createSheetOpen} onOpenChange={handleOpenChange}>
      <Button asChild>
        <SheetTrigger>
          <Plus className="size-4" />
          Create Payout
        </SheetTrigger>
      </Button>
      <SheetContent className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[760px] data-[side=right]:sm:max-w-[760px]">
        <CreateRiderPayoutSheet
          eligibleRiderSummaries={eligibleRiderSummaries}
          isLoadingEligibleRiders={isLoadingEligibleRiders}
          eligibleRidersError={eligibleRidersError}
          onClose={() => setCreateSheetOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

export function RiderPayoutWorkspace({
  pageResult,
  filters: _filters,
  actorRole,
}: RiderPayoutWorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const payouts = pageResult.payouts;
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);
  const selectedPayout = payouts.find((payout) => payout.id === selectedPayoutId) ?? null;

  function updatePage(page: number) {
    const params = new URLSearchParams();

    if (page > 1) {
      params.set("page", String(page));
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Rider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ways</TableHead>
              <TableHead className="text-right">Fee / Way</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[150px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  No rider payouts.
                </TableCell>
              </TableRow>
            ) : (
              payouts.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell className="font-medium">{payout.payoutCode}</TableCell>
                  <TableCell>{payout.riderName}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={getPayoutStatusLabel(payout.status)}
                      variant={getPayoutStatusVariant(payout.status)}
                    />
                  </TableCell>
                  <TableCell className="text-right">{payout.deliveredWayCount}</TableCell>
                  <TableCell className="text-right">{formatMoney(payout.feePerWay)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(payout.totalPayoutAmount)} MMK
                  </TableCell>
                  <TableCell>{formatDate(payout.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {payout.status === "in_progress" &&
                    (actorRole === "super_admin" || actorRole === "office_admin") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedPayoutId(payout.id)}
                      >
                        Manage
                      </Button>
                    ) : payout.status === "settled" ? (
                      <span className="text-sm text-muted-foreground">
                        Paid {formatDate(payout.paidAt)}
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
        open={selectedPayout !== null}
        onOpenChange={(open) => !open && setSelectedPayoutId(null)}
      >
        <SheetContent className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[560px] data-[side=right]:sm:max-w-[560px]">
          {selectedPayout ? (
            <ManageRiderPayoutSheet
              payout={selectedPayout}
              actorRole={actorRole}
              onClose={() => setSelectedPayoutId(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <PaginationControls
        page={pageResult.page}
        totalPages={pageResult.totalPages}
        onPageChange={updatePage}
      />
    </div>
  );
}

function CreateRiderPayoutSheet({
  eligibleRiderSummaries,
  isLoadingEligibleRiders,
  eligibleRidersError,
  onClose,
}: Readonly<{
  eligibleRiderSummaries: RiderPayoutEligibleRiderSummaryDto[];
  isLoadingEligibleRiders: boolean;
  eligibleRidersError: string | null;
  onClose: () => void;
}>) {
  const router = useAppRouter();
  const [isPending, startTransition] = useTransition();
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [feePerWay, setFeePerWay] = useState("");
  const [financialItems, setFinancialItems] = useState<RiderPayoutEligibleFinancialItemDto[]>([]);
  const [isLoadingRiderDetail, setIsLoadingRiderDetail] = useState(false);
  const [riderDetailError, setRiderDetailError] = useState<string | null>(null);
  const selectedRiderSummary =
    eligibleRiderSummaries.find((rider) => rider.riderId === selectedRiderId) ?? null;
  const selectedItems = useMemo(
    () => financialItems.filter((item) => selectedItemIds.includes(item.id)),
    [financialItems, selectedItemIds],
  );
  const numericFeePerWay = Number(feePerWay);
  const payoutTotal =
    Number.isFinite(numericFeePerWay) && numericFeePerWay > 0
      ? selectedItems.length * numericFeePerWay
      : 0;
  const allSelected =
    financialItems.length > 0 && financialItems.every((item) => selectedItemIds.includes(item.id));
  const someSelected = financialItems.some((item) => selectedItemIds.includes(item.id));

  async function selectRider(riderId: string | null) {
    setSelectedRiderId(riderId);
    setSelectedItemIds([]);
    setFinancialItems([]);
    setRiderDetailError(null);
    setSubmissionState(null);

    if (!riderId) {
      return;
    }

    setIsLoadingRiderDetail(true);

    try {
      const result = await getEligibleRiderPayoutRiderDetailAction(riderId);

      if (!result.ok) {
        setRiderDetailError(result.message);
        return;
      }

      setFinancialItems(result.financialItems);
      setSelectedItemIds(result.financialItems.map((item) => item.id));
    } finally {
      setIsLoadingRiderDetail(false);
    }
  }

  function toggleItem(itemId: string, checked: boolean) {
    setSelectedItemIds((current) =>
      checked
        ? current.includes(itemId)
          ? current
          : [...current, itemId]
        : current.filter((id) => id !== itemId),
    );
  }

  function submitPayout() {
    if (!selectedRiderId) {
      setSubmissionState({ kind: "error", message: "Select a rider." });
      return;
    }

    setSubmissionState(null);
    startTransition(async () => {
      const result = await createRiderPayoutDraftAction({
        riderId: selectedRiderId,
        financialItemIds: selectedItemIds,
        feePerWay,
      });

      if (!result.ok) {
        setSubmissionState({ kind: "error", message: result.message });
        return;
      }

      router.refresh();
      onClose();
    });
  }

  return (
    <div className="flex h-full flex-col bg-[#fcfbf8]">
      <SheetHeader className="border-b p-6 text-left">
        <SheetTitle className="text-2xl">Create Rider Payout</SheetTitle>
        <SheetDescription>
          Select pending rider way items and set the fee paid for each way.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        {submissionState ? <FormBanner state={submissionState} /> : null}
        {eligibleRidersError ? (
          <FormBanner state={{ kind: "error", message: eligibleRidersError }} />
        ) : null}

        {isLoadingEligibleRiders ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border bg-white px-6 py-14 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading eligible riders...
          </div>
        ) : eligibleRiderSummaries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-white px-6 py-14 text-center">
            <WalletCards className="size-9 text-muted-foreground" />
            <p className="font-medium">No riders have eligible payout ways.</p>
          </div>
        ) : (
          <>
            <FieldShell htmlFor="rider-payout-rider" label="Rider" required>
              <Select
                value={selectedRiderId}
                onValueChange={(value) => {
                  void selectRider(value);
                }}
              >
                <SelectTrigger id="rider-payout-rider" className={inputClassName}>
                  <SelectValue placeholder="Select rider" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleRiderSummaries.map((rider) => (
                    <SelectItem key={rider.riderId} value={rider.riderId}>
                      {rider.riderName} ({rider.eligibleItemCount} ways)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldShell>

            <FieldShell htmlFor="fee-per-way" label="Fee per way" required>
              <Input
                id="fee-per-way"
                type="number"
                min="1"
                inputMode="numeric"
                value={feePerWay}
                onChange={(event) => setFeePerWay(event.target.value)}
                className={inputClassName}
                placeholder="900"
                disabled={isPending}
              />
            </FieldShell>

            {riderDetailError ? (
              <FormBanner state={{ kind: "error", message: riderDetailError }} />
            ) : null}

            {isLoadingRiderDetail ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading rider ways...
              </div>
            ) : selectedRiderSummary ? (
              <div className="rounded-lg border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          aria-label="Select all rider way items"
                          checked={allSelected}
                          indeterminate={!allSelected && someSelected}
                          onCheckedChange={(checked) =>
                            setSelectedItemIds(checked ? financialItems.map((item) => item.id) : [])
                          }
                        />
                      </TableHead>
                      <TableHead>Parcel</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            aria-label={`Select way for ${item.parcelCode ?? "unlinked parcel"}`}
                            checked={selectedItemIds.includes(item.id)}
                            onCheckedChange={(checked) => toggleItem(item.id, checked)}
                            disabled={isPending}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.parcelCode ?? "Unlinked parcel"}
                        </TableCell>
                        <TableCell>{getRiderWaySourceLabel(item.riderWaySource)}</TableCell>
                        <TableCell>{formatDate(item.createdAt)}</TableCell>
                        <TableCell>
                          <StatusBadge label="Pending" variant="warning" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryMetric label="Selected Ways" value={String(selectedItems.length)} />
              <SummaryMetric label="Payout Total" value={`${formatMoney(payoutTotal)} MMK`} />
            </div>
          </>
        )}
      </div>

      <SheetFooter className="border-t bg-white px-6 py-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={isPending} onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={
            isPending || !selectedRiderId || selectedItemIds.length === 0 || numericFeePerWay < 1
          }
          onClick={submitPayout}
        >
          {isPending ? "Creating..." : "Create Draft"}
        </Button>
      </SheetFooter>
    </div>
  );
}

function ManageRiderPayoutSheet({
  payout,
  actorRole,
  onClose,
}: Readonly<{
  payout: RiderPayoutListItemDto;
  actorRole: UserRole;
  onClose: () => void;
}>) {
  const router = useAppRouter();
  const [isPending, startTransition] = useTransition();
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const [paymentNote, setPaymentNote] = useState("");

  function runAction(action: "settle" | "cancel") {
    setSubmissionState(null);
    startTransition(async () => {
      const result =
        action === "settle"
          ? await settleRiderPayoutAction({ payoutId: payout.id, paymentNote })
          : await cancelRiderPayoutDraftAction({ payoutId: payout.id });

      if (!result.ok) {
        setSubmissionState({ kind: "error", message: result.message });
        return;
      }

      router.refresh();
      onClose();
    });
  }

  return (
    <div className="flex h-full flex-col bg-[#fcfbf8]">
      <SheetHeader className="border-b p-6 text-left">
        <SheetTitle className="text-2xl">Manage Rider Payout</SheetTitle>
        <SheetDescription>
          {payout.payoutCode} · {payout.riderName}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        {submissionState ? <FormBanner state={submissionState} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryMetric label="Ways" value={String(payout.deliveredWayCount)} />
          <SummaryMetric label="Total" value={`${formatMoney(payout.totalPayoutAmount)} MMK`} />
        </div>

        {canSettleRiderPayout(actorRole) ? (
          <div className="space-y-2">
            <Label htmlFor="rider-payout-payment-note">Payment note (optional)</Label>
            <Textarea
              id="rider-payout-payment-note"
              value={paymentNote}
              onChange={(event) => setPaymentNote(event.target.value)}
              placeholder="Transfer reference or internal note"
              disabled={isPending}
            />
          </div>
        ) : null}
      </div>

      <SheetFooter className="border-t bg-white px-6 py-4 sm:flex-row sm:justify-between">
        <Button variant="destructive" disabled={isPending} onClick={() => runAction("cancel")}>
          {isPending ? "Working..." : "Cancel Draft"}
        </Button>
        {canSettleRiderPayout(actorRole) ? (
          <Button disabled={isPending} onClick={() => runAction("settle")}>
            {isPending ? "Working..." : "Mark as Paid"}
          </Button>
        ) : null}
      </SheetFooter>
    </div>
  );
}

function SummaryMetric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function getRiderWaySourceLabel(source: RiderWaySource) {
  if (source === "delivery_attempt") {
    return "Delivery Attempt";
  }

  if (source === "merchant_return") {
    return "Merchant Return";
  }

  return "Legacy Delivery";
}

function getPayoutStatusLabel(status: RiderPayoutListItemDto["status"]) {
  if (status === "in_progress") {
    return "In Progress";
  }

  if (status === "settled") {
    return "Settled";
  }

  return "Void";
}

function getPayoutStatusVariant(status: RiderPayoutListItemDto["status"]) {
  if (status === "settled") {
    return "success";
  }

  if (status === "void") {
    return "destructive";
  }

  return "warning";
}
