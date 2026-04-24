"use client";

import { useActionState, useState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParcelStatusPill } from "@/features/parcels/components/parcel-status-pill";
import {
    COD_STATUSES,
    COLLECTION_STATUSES,
    DELIVERY_FEE_STATUSES,
    PARCEL_STATUSES,
    formatParcelStatusLabel,
} from "@/features/parcels/constants";
import {
    adminCorrectParcelStateAction,
    advanceOfficeParcelStatusAction,
    receiveParcelCashAtOfficeAction,
    resolveParcelDeliveryFeeAction,
} from "@/features/parcels/server/actions";
import { cn } from "@/lib/utils";

type ParcelOperationTone = "muted" | "info" | "success" | "warning" | "danger";
type OperationActionState = {
    ok: boolean;
    message: string;
    fields?: Record<string, string>;
    fieldErrors?: Partial<Record<string, string[]>>;
};

type ParcelOperationsPanelProps = {
    parcel: {
        id: string;
        parcelCode: string;
        parcelStatus: (typeof PARCEL_STATUSES)[number];
        parcelType: "cod" | "non_cod";
        codAmount: string;
        deliveryFee: string;
        deliveryFeePayer: "merchant" | "receiver";
        deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
        codStatus: (typeof COD_STATUSES)[number];
        collectedAmount: string;
        collectionStatus: (typeof COLLECTION_STATUSES)[number];
        merchantSettlementStatus: "pending" | "in_progress" | "settled";
        merchantSettlementId: string | null;
        riderPayoutStatus: "pending" | "in_progress" | "paid";
        paymentNote: string | null;
    };
    operations: {
        movementActions: Array<{
            label: string;
            nextStatus: (typeof PARCEL_STATUSES)[number];
        }>;
        cash: {
            label: string;
            tone: ParcelOperationTone;
            canReceiveAtOffice: boolean;
        };
        deliveryFee: {
            label: string;
            tone: ParcelOperationTone;
            canResolve: boolean;
            resolutionOptions: (typeof DELIVERY_FEE_STATUSES)[number][];
        };
        settlement: {
            label: string;
            tone: ParcelOperationTone;
            blockedReasons: string[];
        };
    };
};

const initialActionState: OperationActionState = {
    ok: true,
    message: "",
    fields: undefined,
    fieldErrors: undefined,
};

const operationToneClasses = {
    muted: "border-border bg-muted text-muted-foreground",
    info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300",
    success:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
    danger: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300",
} satisfies Record<ParcelOperationTone, string>;

function OperationStatePill({
    label,
    tone,
}: Readonly<{ label: string; tone: ParcelOperationTone }>) {
    return (
        <span
            className={cn(
                "inline-flex h-6 items-center rounded-full border px-2.5 text-xs leading-none font-medium whitespace-nowrap",
                operationToneClasses[tone],
            )}
        >
            {label}
        </span>
    );
}

function ActionMessage({
    state,
}: Readonly<{
    state: OperationActionState;
}>) {
    if (!state.message) {
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

export function ParcelOperationsPanel({
    parcel,
    operations,
}: Readonly<ParcelOperationsPanelProps>) {
    const [selectedFeeResolution, setSelectedFeeResolution] = useState(
        operations.deliveryFee.resolutionOptions[0] ?? "paid_by_merchant",
    );
    const [movementState, movementAction, isMovementPending] = useActionState(
        advanceOfficeParcelStatusAction,
        initialActionState,
    );
    const [cashState, cashAction, isCashPending] = useActionState(
        receiveParcelCashAtOfficeAction,
        initialActionState,
    );
    const [feeState, feeAction, isFeePending] = useActionState(
        resolveParcelDeliveryFeeAction,
        initialActionState,
    );
    const [correctionState, correctionAction, isCorrectionPending] = useActionState(
        adminCorrectParcelStateAction,
        initialActionState,
    );
    const correctionFieldError = (fieldName: string) =>
        correctionState.fieldErrors?.[fieldName]?.[0];

    return (
        <section className="space-y-4" id="operations">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">Operations</h2>
                <p className="text-sm text-muted-foreground">
                    Run guided office actions for {parcel.parcelCode}.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <section className="space-y-3 rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold">Parcel Movement</h3>
                            <p className="text-xs text-muted-foreground">
                                Current status is {formatParcelStatusLabel(parcel.parcelStatus)}.
                            </p>
                        </div>
                        <ParcelStatusPill value={parcel.parcelStatus} />
                    </div>

                    {operations.movementActions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {operations.movementActions.map((operation) => (
                                <form key={operation.nextStatus} action={movementAction}>
                                    <input type="hidden" name="parcelId" value={parcel.id} />
                                    <input
                                        type="hidden"
                                        name="nextStatus"
                                        value={operation.nextStatus}
                                    />
                                    <Button type="submit" disabled={isMovementPending}>
                                        {isMovementPending ? "Updating..." : operation.label}
                                    </Button>
                                </form>
                            ))}
                        </div>
                    ) : (
                        <p className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                            No movement action is available for the current parcel state.
                        </p>
                    )}
                    <ActionMessage state={movementState} />
                </section>

                <section className="space-y-3 rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold">Cash Reconciliation</h3>
                            <p className="text-xs text-muted-foreground">
                                COD status is {formatParcelStatusLabel(parcel.codStatus)}.
                            </p>
                        </div>
                        <OperationStatePill
                            label={operations.cash.label}
                            tone={operations.cash.tone}
                        />
                    </div>

                    {operations.cash.canReceiveAtOffice ? (
                        <form action={cashAction} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="parcelId" value={parcel.id} />
                            <Button type="submit" disabled={isCashPending}>
                                {isCashPending ? "Receiving..." : "Receive Cash"}
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                Amount: {parcel.collectedAmount}
                            </p>
                        </form>
                    ) : (
                        <div className="grid gap-2 text-xs">
                            <p>
                                Collection:{" "}
                                <span className="font-medium">
                                    {formatParcelStatusLabel(parcel.collectionStatus)}
                                </span>
                            </p>
                            <p>
                                Collected amount:{" "}
                                <span className="font-medium">{parcel.collectedAmount}</span>
                            </p>
                        </div>
                    )}
                    <ActionMessage state={cashState} />
                </section>

                <section className="space-y-3 rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold">Delivery Fee Resolution</h3>
                            <p className="text-xs text-muted-foreground">
                                Payer: {formatParcelStatusLabel(parcel.deliveryFeePayer)}
                            </p>
                        </div>
                        <OperationStatePill
                            label={operations.deliveryFee.label}
                            tone={operations.deliveryFee.tone}
                        />
                    </div>

                    {operations.deliveryFee.canResolve ? (
                        <form action={feeAction} className="grid gap-3">
                            <input type="hidden" name="parcelId" value={parcel.id} />
                            <div className="grid gap-2">
                                <Label htmlFor={`fee-resolution-${parcel.id}`}>Resolution</Label>
                                <select
                                    id={`fee-resolution-${parcel.id}`}
                                    name="deliveryFeeStatus"
                                    value={selectedFeeResolution}
                                    onChange={(event) =>
                                        setSelectedFeeResolution(
                                            event.target
                                                .value as (typeof DELIVERY_FEE_STATUSES)[number],
                                        )
                                    }
                                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                    required
                                >
                                    {operations.deliveryFee.resolutionOptions.map((status) => (
                                        <option key={status} value={status}>
                                            {formatParcelStatusLabel(status)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`fee-note-${parcel.id}`}>
                                    Payment Note{" "}
                                    {selectedFeeResolution === "waived" ? "*" : "(Optional)"}
                                </Label>
                                <textarea
                                    id={`fee-note-${parcel.id}`}
                                    name="paymentNote"
                                    rows={3}
                                    defaultValue={parcel.paymentNote ?? ""}
                                    required={selectedFeeResolution === "waived"}
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                />
                            </div>
                            <div>
                                <Button type="submit" disabled={isFeePending}>
                                    {isFeePending ? "Resolving..." : "Resolve Fee"}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <div className="grid gap-2 text-xs">
                            <p>
                                Status:{" "}
                                <span className="font-medium">
                                    {formatParcelStatusLabel(parcel.deliveryFeeStatus)}
                                </span>
                            </p>
                            <p>
                                Fee amount:{" "}
                                <span className="font-medium">{parcel.deliveryFee}</span>
                            </p>
                        </div>
                    )}
                    <ActionMessage state={feeState} />
                </section>

                <section className="space-y-3 rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold">Settlement State</h3>
                            <p className="text-xs text-muted-foreground">
                                Settlement status is read-only here.
                            </p>
                        </div>
                        <OperationStatePill
                            label={operations.settlement.label}
                            tone={operations.settlement.tone}
                        />
                    </div>

                    {operations.settlement.blockedReasons.length > 0 ? (
                        <ul className="space-y-1 text-xs text-muted-foreground">
                            {operations.settlement.blockedReasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            No settlement blockers for the current parcel state.
                        </p>
                    )}
                    {parcel.merchantSettlementId && (
                        <p className="font-mono text-xs text-muted-foreground">
                            {parcel.merchantSettlementId}
                        </p>
                    )}
                </section>
            </div>

            <section className="space-y-3 rounded-xl border bg-card p-4">
                <div>
                    <h3 className="text-sm font-semibold">Admin Correction</h3>
                    <p className="text-xs text-muted-foreground">
                        Use only for audited corrections that cannot be handled by normal actions.
                    </p>
                </div>

                <form action={correctionAction} className="grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="parcelId" value={parcel.id} />

                    <div className="grid gap-2">
                        <Label htmlFor={`correct-parcel-status-${parcel.id}`}>Parcel Status</Label>
                        <select
                            id={`correct-parcel-status-${parcel.id}`}
                            name="parcelStatus"
                            defaultValue={parcel.parcelStatus}
                            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            required
                        >
                            {PARCEL_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {formatParcelStatusLabel(status)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor={`correct-delivery-fee-status-${parcel.id}`}>
                            Delivery Fee Status
                        </Label>
                        <select
                            id={`correct-delivery-fee-status-${parcel.id}`}
                            name="deliveryFeeStatus"
                            defaultValue={parcel.deliveryFeeStatus}
                            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            required
                        >
                            {DELIVERY_FEE_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {formatParcelStatusLabel(status)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor={`correct-cod-status-${parcel.id}`}>COD Status</Label>
                        <select
                            id={`correct-cod-status-${parcel.id}`}
                            name="codStatus"
                            defaultValue={parcel.codStatus}
                            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            required
                        >
                            {COD_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {formatParcelStatusLabel(status)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor={`correct-collection-status-${parcel.id}`}>
                            Collection Status
                        </Label>
                        <select
                            id={`correct-collection-status-${parcel.id}`}
                            name="collectionStatus"
                            defaultValue={parcel.collectionStatus}
                            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            required
                        >
                            {COLLECTION_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {formatParcelStatusLabel(status)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor={`correct-collected-amount-${parcel.id}`}>
                            Collected Amount
                        </Label>
                        <Input
                            id={`correct-collected-amount-${parcel.id}`}
                            name="collectedAmount"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={parcel.collectedAmount}
                            required
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor={`correct-payment-note-${parcel.id}`}>
                            Payment Note (Optional)
                        </Label>
                        <textarea
                            id={`correct-payment-note-${parcel.id}`}
                            name="paymentNote"
                            rows={3}
                            defaultValue={parcel.paymentNote ?? ""}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                    </div>

                    <div className="grid gap-2 md:col-span-2">
                        <Label htmlFor={`correction-note-${parcel.id}`}>Correction Note *</Label>
                        <textarea
                            id={`correction-note-${parcel.id}`}
                            name="correctionNote"
                            rows={3}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            required
                        />
                        <FormFieldError message={correctionFieldError("correctionNote")} />
                    </div>

                    <div className="md:col-span-2">
                        <Button type="submit" variant="outline" disabled={isCorrectionPending}>
                            {isCorrectionPending ? "Correcting..." : "Save Correction"}
                        </Button>
                    </div>
                    <div className="md:col-span-2">
                        <ActionMessage state={correctionState} />
                    </div>
                </form>
            </section>
        </section>
    );
}
