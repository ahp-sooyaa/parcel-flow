"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    cancelMerchantSettlementAction,
    confirmMerchantSettlementPaymentAction,
    rejectMerchantSettlementAction,
} from "@/features/merchant-settlements/server/actions";
import { cn } from "@/lib/utils";

import type {
    MerchantSettlementActionResult,
    MerchantSettlementHistoryDto,
} from "@/features/merchant-settlements/server/dto";

type MerchantSettlementHistoryProps = {
    settlements: MerchantSettlementHistoryDto[];
    permissions: {
        canConfirm: boolean;
        canCancel: boolean;
    };
};

const initialState: MerchantSettlementActionResult = {
    ok: true,
    message: "",
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
});
const businessTimeZone = "Asia/Yangon";
const dateTimePartsFormatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    month: "short",
    timeZone: businessTimeZone,
    year: "numeric",
});

function formatMmk(value: string) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "0 MMK";
    }

    return `${moneyFormatter.format(amount)} MMK`;
}

function formatDate(value: Date) {
    const parts = Object.fromEntries(
        dateTimePartsFormatter
            .formatToParts(value)
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value]),
    );

    return `${parts.month} ${parts.day}, ${parts.year}, ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

function formatDirection(value: MerchantSettlementHistoryDto["type"]) {
    return value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function isEditableSettlement(status: MerchantSettlementHistoryDto["status"]) {
    return status === "pending" || status === "in_progress";
}

function SettlementActionMessage({ state }: { state: MerchantSettlementActionResult }) {
    if (
        !state.message ||
        (!state.ok && state.fieldErrors && Object.keys(state.fieldErrors).length > 0)
    ) {
        return null;
    }

    return (
        <p
            className={cn("text-xs", {
                "text-emerald-700": state.ok,
                "text-destructive": !state.ok,
            })}
        >
            {state.message}
        </p>
    );
}

function SettlementHistoryItem({
    settlement,
    permissions,
}: {
    settlement: MerchantSettlementHistoryDto;
    permissions: MerchantSettlementHistoryProps["permissions"];
}) {
    const [confirmState, confirmAction, isConfirmPending] = useActionState(
        confirmMerchantSettlementPaymentAction,
        initialState,
    );
    const [cancelState, cancelAction, isCancelPending] = useActionState(
        cancelMerchantSettlementAction,
        initialState,
    );
    const [rejectState, rejectAction, isRejectPending] = useActionState(
        rejectMerchantSettlementAction,
        initialState,
    );
    const canEdit = isEditableSettlement(settlement.status);
    const returnTo = `/dashboard/merchants/${settlement.merchantId}?tab=settlements`;
    const detailHref = `/dashboard/settlements/${settlement.id}?returnTo=${encodeURIComponent(
        returnTo,
    )}`;

    return (
        <article className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">Settlement {settlement.id.slice(0, 8)}</h3>
                        <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
                            {settlement.status}
                        </span>
                        <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {formatDirection(settlement.type)}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {settlement.itemCount} items · {formatDate(settlement.createdAt)}
                    </p>
                </div>

                <div className="flex flex-col items-start gap-2 md:items-end">
                    <p className="text-lg font-semibold tabular-nums">
                        {formatMmk(settlement.totalAmount)}
                    </p>
                    <Button asChild size="sm" variant="outline">
                        <Link href={detailHref}>View Detail</Link>
                    </Button>
                </div>
            </div>

            <dl className="grid gap-3 text-sm md:grid-cols-3">
                <div className="grid gap-1">
                    <dt className="text-xs text-muted-foreground">Credits</dt>
                    <dd className="tabular-nums">{formatMmk(settlement.creditsTotal)}</dd>
                </div>
                <div className="grid gap-1">
                    <dt className="text-xs text-muted-foreground">Debits</dt>
                    <dd className="tabular-nums">{formatMmk(settlement.debitsTotal)}</dd>
                </div>
                <div className="grid gap-1">
                    <dt className="text-xs text-muted-foreground">Net</dt>
                    <dd className="tabular-nums">{formatMmk(settlement.totalAmount)}</dd>
                </div>
                <div className="grid gap-1">
                    <dt className="text-xs text-muted-foreground">Bank</dt>
                    <dd>{settlement.snapshotBankName ?? "-"}</dd>
                </div>
                <div className="grid gap-1">
                    <dt className="text-xs text-muted-foreground">Account Number</dt>
                    <dd>{settlement.snapshotBankAccountNumber ?? "-"}</dd>
                </div>
                <div className="grid gap-1">
                    <dt className="text-xs text-muted-foreground">Reference</dt>
                    <dd>{settlement.referenceNo ?? "-"}</dd>
                </div>
                <div className="grid gap-1">
                    <dt className="text-xs text-muted-foreground">Created By</dt>
                    <dd>{settlement.createdByName}</dd>
                </div>
                <div className="grid gap-1">
                    <dt className="text-xs text-muted-foreground">Confirmed By</dt>
                    <dd>{settlement.confirmedByName ?? "-"}</dd>
                </div>
                <div className="grid gap-1">
                    <dt className="text-xs text-muted-foreground">Updated</dt>
                    <dd>{formatDate(settlement.updatedAt)}</dd>
                </div>
            </dl>

            {settlement.paymentSlipImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {settlement.paymentSlipImages.map((image, index) => (
                        <a
                            key={image.key}
                            href={image.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                            Payment Slip {index + 1}
                        </a>
                    ))}
                </div>
            )}

            {permissions.canConfirm && canEdit && (
                <form
                    action={confirmAction}
                    className="grid gap-3 rounded-lg border p-3 md:grid-cols-3"
                >
                    <input type="hidden" name="settlementId" value={settlement.id} />
                    <div className="grid gap-2">
                        <Label htmlFor={`reference-${settlement.id}`}>Reference Number</Label>
                        <Input id={`reference-${settlement.id}`} name="referenceNo" required />
                        <FormFieldError message={confirmState.fieldErrors?.referenceNo?.[0]} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor={`payment-slip-${settlement.id}`}>Payment Slip</Label>
                        <Input
                            id={`payment-slip-${settlement.id}`}
                            name="paymentSlipImage"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            required
                        />
                        <FormFieldError message={confirmState.fieldErrors?.paymentSlipImage?.[0]} />
                    </div>
                    <div className="flex items-end">
                        <Button type="submit" disabled={isConfirmPending}>
                            {isConfirmPending ? "Confirming..." : "Mark Paid"}
                        </Button>
                    </div>
                    <div className="md:col-span-3">
                        <SettlementActionMessage state={confirmState} />
                    </div>
                </form>
            )}

            {canEdit && permissions.canCancel && (
                <div className="flex flex-wrap items-center gap-2">
                    <form action={cancelAction}>
                        <input type="hidden" name="settlementId" value={settlement.id} />
                        <Button type="submit" variant="outline" disabled={isCancelPending}>
                            {isCancelPending ? "Cancelling..." : "Cancel"}
                        </Button>
                    </form>
                    <form action={rejectAction}>
                        <input type="hidden" name="settlementId" value={settlement.id} />
                        <Button type="submit" variant="outline" disabled={isRejectPending}>
                            {isRejectPending ? "Rejecting..." : "Reject"}
                        </Button>
                    </form>
                    <SettlementActionMessage
                        state={cancelState.message ? cancelState : rejectState}
                    />
                </div>
            )}
        </article>
    );
}

export function MerchantSettlementHistory({
    settlements,
    permissions,
}: Readonly<MerchantSettlementHistoryProps>) {
    if (settlements.length === 0) {
        return (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                No settlements found.
            </div>
        );
    }

    return (
        <div className="mb-[110px] space-y-3">
            {settlements.map((settlement) => (
                <SettlementHistoryItem
                    key={settlement.id}
                    settlement={settlement}
                    permissions={permissions}
                />
            ))}
        </div>
    );
}
