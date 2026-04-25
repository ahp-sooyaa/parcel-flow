"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { MerchantListItemDto } from "@/features/merchant/server/dto";

type NewSettlementEntryProps = {
    merchants: MerchantListItemDto[];
};

export function NewSettlementEntry({ merchants }: Readonly<NewSettlementEntryProps>) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedMerchantId, setSelectedMerchantId] = useState("");
    const [isRedirectPending, startRedirect] = useTransition();
    const hasMerchants = merchants.length > 0;

    function openPrompt() {
        if (!hasMerchants) {
            return;
        }

        setIsOpen(true);
    }

    function closePrompt() {
        setIsOpen(false);
        setSelectedMerchantId("");
    }

    function continueToWorkspace() {
        if (!selectedMerchantId) {
            return;
        }

        startRedirect(() => {
            router.push(`/dashboard/merchants/${selectedMerchantId}?settle=1`);
        });
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex justify-end">
                <Button
                    size="sm"
                    onClick={openPrompt}
                    disabled={!hasMerchants || isRedirectPending}
                >
                    + New Settlement
                </Button>
            </div>

            {isOpen && (
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-end">
                    <div className="grid gap-2 sm:min-w-80">
                        <Label htmlFor="merchant-settlement-entry-merchant">Select Merchant</Label>
                        <select
                            id="merchant-settlement-entry-merchant"
                            value={selectedMerchantId}
                            onChange={(event) => setSelectedMerchantId(event.target.value)}
                            className={cn(
                                "h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none",
                                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                            )}
                        >
                            <option value="">Choose a merchant</option>
                            {merchants.map((merchant) => (
                                <option key={merchant.id} value={merchant.id}>
                                    {merchant.shopName} · {merchant.contactName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            onClick={continueToWorkspace}
                            disabled={!selectedMerchantId || isRedirectPending}
                        >
                            {isRedirectPending ? "Opening..." : "Continue"}
                        </Button>
                        <Button type="button" variant="outline" onClick={closePrompt}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {!hasMerchants && (
                <p className="text-right text-xs text-muted-foreground">
                    No merchants available for settlement creation.
                </p>
            )}
        </div>
    );
}
