"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import {
    SearchableCombobox,
    type SearchableComboboxOption,
} from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { ParcelStatusPill } from "@/features/parcels/components/parcel-status-pill";
import { PARCEL_STATUSES } from "@/features/parcels/constants";
import { bulkAssignParcelRiderAction } from "@/features/parcels/server/actions";
import { cn } from "@/lib/utils";

type OperationTone = "muted" | "info" | "success" | "warning" | "danger";

type ParcelListTableRow = {
    id: string;
    parcelCode: string;
    merchantLabel: string;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipName: string | null;
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    actionHref: string;
    detailHref: string;
    actionLabel: string;
    operations: {
        cash: {
            label: string;
            tone: OperationTone;
        };
        deliveryFee: {
            label: string;
            tone: OperationTone;
        };
        settlement: {
            label: string;
            tone: OperationTone;
            blockedReason: string | null;
        };
    };
};

type ParcelListTableProps = {
    rows: ParcelListTableRow[];
    riderOptions: SearchableComboboxOption[];
    canUpdate: boolean;
    emptyMessage: string;
};

type BulkAssignParcelRiderFormState = {
    ok: boolean;
    message: string;
    fieldErrors?: Partial<Record<string, string[]>>;
};

const initialState: BulkAssignParcelRiderFormState = {
    ok: true,
    message: "",
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
} satisfies Record<OperationTone, string>;

function OperationState({
    label,
    tone,
}: Readonly<{
    label: string;
    tone: OperationTone;
}>) {
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

export function ParcelListTable({
    rows,
    riderOptions,
    canUpdate,
    emptyMessage,
}: Readonly<ParcelListTableProps>) {
    const [assignState, assignAction, isAssignPending] = useActionState(
        async (_prevState: typeof initialState, formData: FormData) =>
            bulkAssignParcelRiderAction(initialState, formData),
        initialState,
    );
    const [clearState, clearAction, isClearPending] = useActionState(
        async (_prevState: typeof initialState, formData: FormData) =>
            bulkAssignParcelRiderAction(initialState, formData),
        initialState,
    );
    const [sheetOpen, setSheetOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectedRiderId, setSelectedRiderId] = useState("");
    const isPending = isAssignPending || isClearPending;
    const selectedIdsList = Array.from(selectedIds);
    const successState = assignState.ok && assignState.message ? assignState : clearState;
    const messageState =
        clearState.message && !clearState.ok
            ? clearState
            : assignState.message
              ? assignState
              : clearState.message
                ? clearState
                : assignState.message
                  ? assignState
                  : successState;
    const allRowsSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

    useEffect(() => {
        if ((assignState.ok && assignState.message) || (clearState.ok && clearState.message)) {
            setSelectedIds(new Set());
            setSelectedRiderId("");
            setSheetOpen(false);
        }
    }, [assignState.message, assignState.ok, clearState.message, clearState.ok]);

    function setSelected(parcelId: string, checked: boolean) {
        setSelectedIds((current) => {
            const next = new Set(current);

            if (checked) {
                next.add(parcelId);
            } else {
                next.delete(parcelId);
            }

            return next;
        });
    }

    function setAllSelected(checked: boolean) {
        setSelectedIds(checked ? new Set(rows.map((row) => row.id)) : new Set());
    }

    return (
        <div className="space-y-4">
            <section className="rounded-xl border bg-card">
                {canUpdate ? (
                    <div className="border-b px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold">Parcels</h2>
                                <p className="text-sm text-muted-foreground">
                                    {selectedIdsList.length === 0
                                        ? "Select parcels on this page to assign or clear a rider."
                                        : `${selectedIdsList.length} parcel${selectedIdsList.length === 1 ? "" : "s"} selected on this page.`}
                                </p>
                            </div>

                            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                                <div className="flex flex-wrap items-center gap-2">
                                    <form action={clearAction}>
                                        {selectedIdsList.map((parcelId) => (
                                            <input
                                                key={`header-clear-${parcelId}`}
                                                type="hidden"
                                                name="parcelIds"
                                                value={parcelId}
                                            />
                                        ))}
                                        <input type="hidden" name="riderId" value="" />
                                        <Button
                                            type="submit"
                                            size="sm"
                                            variant="outline"
                                            disabled={isPending || selectedIdsList.length === 0}
                                        >
                                            {isClearPending ? "Clearing..." : "Clear Rider"}
                                        </Button>
                                    </form>

                                    <SheetTrigger asChild>
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={selectedIdsList.length === 0}
                                        >
                                            Bulk Assign
                                        </Button>
                                    </SheetTrigger>
                                </div>

                                <SheetContent
                                    side="bottom"
                                    className="max-h-[85vh] rounded-t-2xl border-x-0 border-b-0"
                                >
                                    <div className="flex h-full flex-col gap-0">
                                        <SheetHeader className="pr-8">
                                            <SheetTitle>Bulk Rider Assignment</SheetTitle>
                                            <SheetDescription>
                                                Assign or clear a rider for {selectedIdsList.length}{" "}
                                                selected parcel
                                                {selectedIdsList.length === 1 ? "" : "s"}.
                                            </SheetDescription>
                                        </SheetHeader>

                                        <div className="flex-1 space-y-6 overflow-y-auto py-6">
                                            <form
                                                action={assignAction}
                                                className="flex h-full flex-col gap-0"
                                            >
                                                <div className="flex-1 space-y-6 overflow-y-auto">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="bulk-rider-id">
                                                            Assign Rider
                                                        </Label>
                                                        {selectedIdsList.map((parcelId) => (
                                                            <input
                                                                key={`assign-${parcelId}`}
                                                                type="hidden"
                                                                name="parcelIds"
                                                                value={parcelId}
                                                            />
                                                        ))}
                                                        <SearchableCombobox
                                                            id="bulk-rider-id"
                                                            name="riderId"
                                                            value={selectedRiderId}
                                                            onValueChange={setSelectedRiderId}
                                                            options={riderOptions}
                                                            placeholder="Search active riders"
                                                            emptyLabel="No riders found."
                                                            disabled={
                                                                isPending ||
                                                                selectedIdsList.length === 0
                                                            }
                                                            allowClear
                                                            invalid={Boolean(
                                                                assignState.fieldErrors?.riderId,
                                                            )}
                                                        />
                                                        <FormFieldError
                                                            message={
                                                                assignState.fieldErrors
                                                                    ?.riderId?.[0]
                                                            }
                                                        />
                                                        <FormFieldError
                                                            message={
                                                                assignState.fieldErrors
                                                                    ?.parcelIds?.[0]
                                                            }
                                                        />
                                                    </div>

                                                    {messageState.message ? (
                                                        <p
                                                            className={cn("text-xs", {
                                                                "text-emerald-700": messageState.ok,
                                                                "text-destructive":
                                                                    !messageState.ok,
                                                            })}
                                                        >
                                                            {messageState.message}
                                                        </p>
                                                    ) : null}
                                                </div>

                                                <SheetFooter className="mt-auto border-t pt-4">
                                                    <Button
                                                        type="submit"
                                                        disabled={
                                                            isPending ||
                                                            selectedIdsList.length === 0 ||
                                                            !selectedRiderId
                                                        }
                                                    >
                                                        {isAssignPending
                                                            ? "Assigning..."
                                                            : "Assign Rider"}
                                                    </Button>
                                                </SheetFooter>
                                            </form>
                                        </div>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>
                ) : null}

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/40 text-xs uppercase">
                            <tr>
                                {canUpdate ? (
                                    <th className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={allRowsSelected}
                                            onChange={(event) =>
                                                setAllSelected(event.target.checked)
                                            }
                                            aria-label="Select all parcels on this page"
                                            className="h-4 w-4"
                                        />
                                    </th>
                                ) : null}
                                <th className="px-4 py-3">Code / Merchant</th>
                                <th className="px-4 py-3">Recipient</th>
                                <th className="px-4 py-3">Township</th>
                                <th className="px-4 py-3">Parcel Status</th>
                                <th className="px-4 py-3">COD Cash</th>
                                <th className="px-4 py-3">Delivery Fee</th>
                                <th className="px-4 py-3">Settlement</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id} className="border-t">
                                    {canUpdate ? (
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(row.id)}
                                                onChange={(event) =>
                                                    setSelected(row.id, event.target.checked)
                                                }
                                                aria-label={`Select parcel ${row.parcelCode}`}
                                                className="h-4 w-4"
                                            />
                                        </td>
                                    ) : null}
                                    <td className="px-4 py-3">
                                        <div className="grid gap-1">
                                            <span className="font-mono">{row.parcelCode}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {row.merchantLabel}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="grid gap-1">
                                            <span>{row.recipientName}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {row.recipientPhone}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {row.recipientTownshipName ?? "-"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <ParcelStatusPill value={row.parcelStatus} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <OperationState
                                            label={row.operations.cash.label}
                                            tone={row.operations.cash.tone}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <OperationState
                                            label={row.operations.deliveryFee.label}
                                            tone={row.operations.deliveryFee.tone}
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="grid gap-1">
                                            <OperationState
                                                label={row.operations.settlement.label}
                                                tone={row.operations.settlement.tone}
                                            />
                                            {row.operations.settlement.blockedReason ? (
                                                <span className="max-w-52 text-xs text-muted-foreground">
                                                    {row.operations.settlement.blockedReason}
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Button asChild size="sm">
                                                <Link href={row.actionHref}>{row.actionLabel}</Link>
                                            </Button>
                                            {canUpdate ? (
                                                <Button asChild size="sm" variant="outline">
                                                    <Link href={row.detailHref}>Details</Link>
                                                </Button>
                                            ) : null}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={canUpdate ? 10 : 9}
                                        className="px-4 py-10 text-center text-xs text-muted-foreground"
                                    >
                                        {emptyMessage}
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
