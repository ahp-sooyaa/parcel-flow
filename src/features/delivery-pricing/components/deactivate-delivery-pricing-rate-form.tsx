"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { deactivateDeliveryPricingRateAction } from "@/features/delivery-pricing/server/actions";
import { cn } from "@/lib/utils";

const initialState = {
    ok: true,
    message: "",
};

type DeactivateDeliveryPricingRateFormProps = {
    rateId: string;
    disabled?: boolean;
};

export function DeactivateDeliveryPricingRateForm({
    rateId,
    disabled = false,
}: Readonly<DeactivateDeliveryPricingRateFormProps>) {
    const [state, action, isPending] = useActionState(
        async (_prevState: typeof initialState, formData: FormData) =>
            deactivateDeliveryPricingRateAction(formData),
        initialState,
    );

    return (
        <form action={action} className="flex flex-col items-start gap-2">
            <input type="hidden" name="rateId" value={rateId} />
            <Button type="submit" variant="outline" size="sm" disabled={disabled || isPending}>
                {isPending ? "Deactivating..." : "Deactivate"}
            </Button>
            {state.message ? (
                <p
                    className={cn("text-xs", {
                        "text-emerald-700": state.ok,
                        "text-destructive": !state.ok,
                    })}
                >
                    {state.message}
                </p>
            ) : null}
        </form>
    );
}
