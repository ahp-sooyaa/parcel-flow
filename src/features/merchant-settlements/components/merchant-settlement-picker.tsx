"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generateMerchantSettlementAction } from "@/features/merchant-settlements/server/actions";
import { cn } from "@/lib/utils";

import type { BankAccountDto } from "@/features/bank-accounts/server/dto";
import type {
    EligibleMerchantSettlementParcelDto,
    MerchantSettlementActionResult,
} from "@/features/merchant-settlements/server/dto";

type MerchantSettlementPickerProps = {
    merchantId: string;
    parcels: EligibleMerchantSettlementParcelDto[];
    bankAccounts: BankAccountDto[];
};

const initialState: MerchantSettlementActionResult = {
    ok: true,
    message: "",
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
});

function formatMmk(value: number | string) {
    const amount = typeof value === "string" ? Number(value) : value;

    if (!Number.isFinite(amount)) {
        return "0 MMK";
    }

    return `${moneyFormatter.format(amount)} MMK`;
}

export function MerchantSettlementPicker({
    merchantId,
    parcels,
    bankAccounts,
}: Readonly<MerchantSettlementPickerProps>) {
    const [state, action, isPending] = useActionState(
        generateMerchantSettlementAction,
        initialState,
    );
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (state.ok && state.settlementId) {
            setSelectedIds(new Set());
        }
    }, [state.ok, state.settlementId]);

    const selectedParcels = useMemo(
        () => parcels.filter((parcel) => selectedIds.has(parcel.paymentRecordId)),
        [parcels, selectedIds],
    );
    const selectedCodTotal = selectedParcels.reduce(
        (sum, parcel) => sum + Number(parcel.codAmount),
        0,
    );
    const selectedNetTotal = selectedParcels.reduce(
        (sum, parcel) => sum + Number(parcel.netPayableAmount),
        0,
    );
    const hasSelection = selectedParcels.length > 0;
    const canGenerate = hasSelection && bankAccounts.length > 0 && !isPending;

    function setSelected(paymentRecordId: string, checked: boolean) {
        setSelectedIds((current) => {
            const next = new Set(current);

            if (checked) {
                next.add(paymentRecordId);
            } else {
                next.delete(paymentRecordId);
            }

            return next;
        });
    }

    function setAllSelected(checked: boolean) {
        setSelectedIds(
            checked ? new Set(parcels.map((parcel) => parcel.paymentRecordId)) : new Set(),
        );
    }

    return (
        <form action={action} className="space-y-4 pb-24">
            <input type="hidden" name="merchantId" value={merchantId} />

            <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={
                                        parcels.length > 0 && selectedIds.size === parcels.length
                                    }
                                    onChange={(event) => setAllSelected(event.target.checked)}
                                    aria-label="Select all parcels"
                                    className="h-4 w-4"
                                />
                            </th>
                            <th className="px-4 py-3">Parcel Code</th>
                            <th className="px-4 py-3">Recipient</th>
                            <th className="px-4 py-3">Township</th>
                            <th className="px-4 py-3">COD</th>
                            <th className="px-4 py-3">Delivery Fee</th>
                            <th className="px-4 py-3">Net Payable</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parcels.map((parcel) => (
                            <tr key={parcel.paymentRecordId} className="border-t">
                                <td className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        name="paymentRecordIds"
                                        value={parcel.paymentRecordId}
                                        checked={selectedIds.has(parcel.paymentRecordId)}
                                        onChange={(event) =>
                                            setSelected(
                                                parcel.paymentRecordId,
                                                event.target.checked,
                                            )
                                        }
                                        className="h-4 w-4"
                                    />
                                </td>
                                <td className="px-4 py-3">{parcel.parcelCode}</td>
                                <td className="px-4 py-3">{parcel.recipientName}</td>
                                <td className="px-4 py-3">{parcel.recipientTownshipName ?? "-"}</td>
                                <td className="px-4 py-3 tabular-nums">
                                    {formatMmk(parcel.codAmount)}
                                </td>
                                <td className="px-4 py-3 tabular-nums">
                                    {parcel.isDeliveryFeeDeducted
                                        ? `-${formatMmk(parcel.deliveryFee)}`
                                        : formatMmk(0)}
                                </td>
                                <td className="px-4 py-3 tabular-nums">
                                    {formatMmk(parcel.netPayableAmount)}
                                </td>
                            </tr>
                        ))}
                        {parcels.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-10 text-center text-xs text-muted-foreground"
                                >
                                    No eligible parcels are available for settlement.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="fixed right-4 bottom-4 left-4 z-20 z-99 rounded-xl border bg-background p-4 shadow-lg md:left-[calc(var(--sidebar-width,0px)+1rem)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="grid gap-1">
                        <p className="text-sm font-medium">
                            {selectedParcels.length} selected · COD {formatMmk(selectedCodTotal)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Net payable {formatMmk(selectedNetTotal)}
                        </p>
                        {state.message && (
                            <p
                                className={cn("text-xs", {
                                    "text-emerald-700": state.ok,
                                    "text-destructive": !state.ok,
                                })}
                            >
                                {state.message}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-2 lg:min-w-80">
                        <Label htmlFor="settlement-bank-account">Merchant Bank Account</Label>
                        <select
                            id="settlement-bank-account"
                            name="bankAccountId"
                            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            required
                            disabled={bankAccounts.length === 0}
                            defaultValue={
                                bankAccounts.find((account) => account.isPrimary)?.id ??
                                bankAccounts[0]?.id ??
                                ""
                            }
                        >
                            <option value="" disabled>
                                Select bank account
                            </option>
                            {bankAccounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.bankName} · {account.bankAccountNumber}
                                </option>
                            ))}
                        </select>
                    </div>

                    <Button type="submit" disabled={!canGenerate}>
                        {isPending ? "Generating..." : "Generate Settlement"}
                    </Button>
                </div>
            </div>
        </form>
    );
}
