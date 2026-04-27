"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generateMerchantSettlementAction } from "@/features/merchant-settlements/server/actions";
import { cn } from "@/lib/utils";

import type { BankAccountDto } from "@/features/bank-accounts/server/dto";
import type {
    BlockedMerchantSettlementCandidateDto,
    MerchantSettlementActionResult,
    MerchantSettlementPreset,
    ReadyMerchantSettlementCandidateDto,
} from "@/features/merchant-settlements/server/dto";

type MerchantSettlementPickerProps = {
    merchantId: string;
    readyCandidates: ReadyMerchantSettlementCandidateDto[];
    blockedCandidates: BlockedMerchantSettlementCandidateDto[];
    merchantBankAccounts: BankAccountDto[];
    companyBankAccounts: BankAccountDto[];
    preset: MerchantSettlementPreset;
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

function formatLabel(value: string) {
    return value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function getDirectionLabel(direction: "invoice" | "remit" | "balanced") {
    if (direction === "balanced") {
        return "Balanced";
    }

    return direction === "invoice" ? "Invoice" : "Remit";
}

function getSummaryDirection(netTotal: number) {
    if (netTotal > 0) {
        return "remit" as const;
    }

    if (netTotal < 0) {
        return "invoice" as const;
    }

    return "balanced" as const;
}

function getSettlementBankAccountLabel(direction: "invoice" | "remit" | "balanced") {
    if (direction === "invoice") {
        return "Company Bank Account";
    }

    if (direction === "balanced") {
        return "Bank Account";
    }

    return "Merchant Bank Account";
}

function matchesPreset(
    candidate: Pick<ReadyMerchantSettlementCandidateDto, "kind" | "parcelStatus">,
    preset: MerchantSettlementPreset,
) {
    if (preset === "all") {
        return true;
    }

    if (preset === "cod") {
        return candidate.kind === "cod_remit_credit";
    }

    if (preset === "fees") {
        return candidate.kind === "delivery_fee_charge";
    }

    return (
        candidate.kind === "refund_credit" ||
        candidate.parcelStatus === "returned" ||
        candidate.parcelStatus === "cancelled" ||
        candidate.parcelStatus === "return_to_merchant" ||
        candidate.parcelStatus === "return_to_office"
    );
}

function calculateSummary(candidates: ReadyMerchantSettlementCandidateDto[]) {
    const creditsTotal = candidates.reduce(
        (sum, candidate) =>
            sum + (candidate.direction === "company_owes_merchant" ? Number(candidate.amount) : 0),
        0,
    );
    const debitsTotal = candidates.reduce(
        (sum, candidate) =>
            sum + (candidate.direction === "merchant_owes_company" ? Number(candidate.amount) : 0),
        0,
    );
    const netTotal = creditsTotal - debitsTotal;

    return {
        selectedCount: candidates.length,
        creditsTotal,
        debitsTotal,
        netTotal,
        direction: getSummaryDirection(netTotal),
    } as const;
}

function getDefaultBankAccountId(accounts: BankAccountDto[]) {
    return accounts.find((account) => account.isPrimary)?.id ?? accounts[0]?.id ?? "";
}

export function MerchantSettlementPicker({
    merchantId,
    readyCandidates,
    blockedCandidates,
    merchantBankAccounts,
    companyBankAccounts,
    preset,
}: Readonly<MerchantSettlementPickerProps>) {
    const [state, action, isPending] = useActionState(
        generateMerchantSettlementAction,
        initialState,
    );
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bankAccountId, setBankAccountId] = useState("");

    const visibleReadyCandidates = useMemo(
        () => readyCandidates.filter((candidate) => matchesPreset(candidate, preset)),
        [preset, readyCandidates],
    );
    const visibleBlockedCandidates = useMemo(
        () => blockedCandidates.filter((candidate) => matchesPreset(candidate, preset)),
        [blockedCandidates, preset],
    );
    const selectedCandidates = useMemo(
        () => readyCandidates.filter((candidate) => selectedIds.has(candidate.id)),
        [readyCandidates, selectedIds],
    );
    const summary = useMemo(() => calculateSummary(selectedCandidates), [selectedCandidates]);
    const requiresBankAccount = summary.direction !== "balanced";
    const activeBankAccounts =
        summary.direction === "invoice" ? companyBankAccounts : merchantBankAccounts;
    const canGenerate =
        summary.selectedCount > 0 && (!requiresBankAccount || Boolean(bankAccountId)) && !isPending;

    useEffect(() => {
        if (state.ok && state.settlementId) {
            setSelectedIds(new Set());
        }
    }, [state.ok, state.settlementId]);

    useEffect(() => {
        if (preset === "cod") {
            setSelectedIds(new Set(visibleReadyCandidates.map((candidate) => candidate.id)));
            return;
        }

        setSelectedIds(new Set());
    }, [merchantId, preset, visibleReadyCandidates]);

    useEffect(() => {
        if (!requiresBankAccount) {
            setBankAccountId("");
            return;
        }

        const nextBankAccountId =
            activeBankAccounts.find((account) => account.id === bankAccountId)?.id ??
            getDefaultBankAccountId(activeBankAccounts);

        setBankAccountId(nextBankAccountId);
    }, [activeBankAccounts, bankAccountId, requiresBankAccount]);

    function setSelected(financialItemId: string, checked: boolean) {
        setSelectedIds((current) => {
            const next = new Set(current);

            if (checked) {
                next.add(financialItemId);
            } else {
                next.delete(financialItemId);
            }

            return next;
        });
    }

    function setAllSelected(checked: boolean) {
        setSelectedIds(
            checked ? new Set(visibleReadyCandidates.map((candidate) => candidate.id)) : new Set(),
        );
    }

    return (
        <form action={action} className="space-y-4 pb-24">
            <input type="hidden" name="merchantId" value={merchantId} />
            {!requiresBankAccount && <input type="hidden" name="bankAccountId" value="" />}

            <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={
                                        visibleReadyCandidates.length > 0 &&
                                        visibleReadyCandidates.every((candidate) =>
                                            selectedIds.has(candidate.id),
                                        )
                                    }
                                    onChange={(event) => setAllSelected(event.target.checked)}
                                    aria-label="Select all settlement candidates"
                                    className="h-4 w-4"
                                />
                            </th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Direction</th>
                            <th className="px-4 py-3">Parcel</th>
                            <th className="px-4 py-3">Recipient</th>
                            <th className="px-4 py-3">Township</th>
                            <th className="px-4 py-3">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleReadyCandidates.map((candidate) => (
                            <tr key={candidate.id} className="border-t">
                                <td className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        name="financialItemIds"
                                        value={candidate.id}
                                        checked={selectedIds.has(candidate.id)}
                                        onChange={(event) =>
                                            setSelected(candidate.id, event.target.checked)
                                        }
                                        className="h-4 w-4"
                                    />
                                </td>
                                <td className="px-4 py-3">{formatLabel(candidate.kind)}</td>
                                <td className="px-4 py-3">{formatLabel(candidate.direction)}</td>
                                <td className="px-4 py-3">
                                    <div className="grid gap-0.5">
                                        <span>{candidate.parcelCode ?? "Manual item"}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {candidate.parcelStatus
                                                ? formatLabel(candidate.parcelStatus)
                                                : "No parcel"}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">{candidate.recipientName ?? "-"}</td>
                                <td className="px-4 py-3">
                                    {candidate.recipientTownshipName ?? "-"}
                                </td>
                                <td className="px-4 py-3 font-medium tabular-nums">
                                    {formatMmk(candidate.amount)}
                                </td>
                            </tr>
                        ))}
                        {visibleReadyCandidates.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-10 text-center text-xs text-muted-foreground"
                                >
                                    No ready settlement candidates match this workspace view.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {visibleBlockedCandidates.length > 0 && (
                <section className="space-y-3 rounded-xl border bg-card p-4">
                    <div>
                        <h3 className="text-sm font-semibold">Blocked Candidates</h3>
                        <p className="text-xs text-muted-foreground">
                            These candidates are tracked but not ready for settlement yet.
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/40 text-xs uppercase">
                                <tr>
                                    <th className="px-3 py-2">Type</th>
                                    <th className="px-3 py-2">Parcel</th>
                                    <th className="px-3 py-2">Direction</th>
                                    <th className="px-3 py-2">Amount</th>
                                    <th className="px-3 py-2">Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleBlockedCandidates.map((candidate) => (
                                    <tr key={candidate.id} className="border-t">
                                        <td className="px-3 py-2">{formatLabel(candidate.kind)}</td>
                                        <td className="px-3 py-2">
                                            {candidate.parcelCode ?? "Manual item"}
                                        </td>
                                        <td className="px-3 py-2">
                                            {formatLabel(candidate.direction)}
                                        </td>
                                        <td className="px-3 py-2 tabular-nums">
                                            {formatMmk(candidate.amount)}
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                            {candidate.blockedReasons.join(" ")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <div className="fixed right-4 bottom-4 left-4 z-50 rounded-xl border bg-background p-4 shadow-lg md:left-[calc(var(--sidebar-width,0px)+1rem)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="grid gap-1">
                        <p className="text-sm font-medium">
                            {summary.selectedCount} selected · Credits{" "}
                            {formatMmk(summary.creditsTotal)} · Debits{" "}
                            {formatMmk(summary.debitsTotal)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Net {formatMmk(summary.netTotal)} ·{" "}
                            {getDirectionLabel(summary.direction)}
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
                        <Label htmlFor="settlement-bank-account">
                            {getSettlementBankAccountLabel(summary.direction)}
                        </Label>
                        {requiresBankAccount ? (
                            <select
                                id="settlement-bank-account"
                                name="bankAccountId"
                                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                required
                                disabled={activeBankAccounts.length === 0}
                                value={bankAccountId}
                                onChange={(event) => setBankAccountId(event.target.value)}
                            >
                                <option value="" disabled>
                                    Select bank account
                                </option>
                                {activeBankAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.bankName} · {account.bankAccountNumber}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                                Balanced settlement does not require bank details.
                            </div>
                        )}
                    </div>

                    <Button type="submit" disabled={!canGenerate}>
                        {isPending ? "Generating..." : "Generate Settlement"}
                    </Button>
                </div>
            </div>
        </form>
    );
}
