"use client";

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
    MerchantSettlementStatus,
} from "@/features/merchant-settlements/server/dto";

type MerchantSettlementPaymentActionsProps = {
    settlement: {
        id: string;
        status: MerchantSettlementStatus;
        type: "invoice" | "remit" | "balanced";
    };
    permissions: {
        canConfirm: boolean;
        canCancel: boolean;
    };
};

const initialState: MerchantSettlementActionResult = {
    ok: true,
    message: "",
};

function isEditableSettlement(status: MerchantSettlementStatus) {
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

export function MerchantSettlementPaymentActions({
    settlement,
    permissions,
}: Readonly<MerchantSettlementPaymentActionsProps>) {
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

    if (!canEdit || (!permissions.canConfirm && !permissions.canCancel)) {
        return null;
    }

    return (
        <section className="space-y-3 rounded-xl border bg-card p-4">
            <div>
                <h2 className="text-lg font-semibold">Settlement Actions</h2>
                <p className="text-sm text-muted-foreground">
                    Confirm settlement payment for remit or invoice documents, or release locked
                    settlement items by cancelling or rejecting the document.
                </p>
            </div>

            {permissions.canConfirm && (
                <form
                    action={confirmAction}
                    className="grid gap-3 rounded-lg border p-3 md:grid-cols-3"
                >
                    <input type="hidden" name="settlementId" value={settlement.id} />
                    <div className="grid gap-2">
                        <Label htmlFor={`detail-reference-${settlement.id}`}>
                            Reference Number
                        </Label>
                        <Input
                            id={`detail-reference-${settlement.id}`}
                            name="referenceNo"
                            required
                        />
                        <FormFieldError message={confirmState.fieldErrors?.referenceNo?.[0]} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor={`detail-payment-slip-${settlement.id}`}>Payment Slip</Label>
                        <Input
                            id={`detail-payment-slip-${settlement.id}`}
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

            {permissions.canCancel && (
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
        </section>
    );
}
