"use client";

import { useActionState, useState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { updateDeliveryPricingRateAction } from "@/features/delivery-pricing/server/actions";
import { cn } from "@/lib/utils";

const initialState = {
    ok: true,
    message: "",
    fieldErrors: undefined,
};

type EditDeliveryPricingRateFormProps = {
    rate: {
        id: string;
        townshipId: string;
        merchantId: string | null;
        baseWeightKg: string;
        baseFee: string;
        extraWeightUnitKg: string;
        extraWeightFee: string;
        volumetricDivisor: number;
        codFeePercent: string;
        returnFeePercent: string;
        isActive: boolean;
    };
    merchants: {
        id: string;
        label: string;
    }[];
    townships: {
        id: string;
        label: string;
    }[];
};

export function EditDeliveryPricingRateForm({
    rate,
    merchants,
    townships,
}: Readonly<EditDeliveryPricingRateFormProps>) {
    const [state, action, isPending] = useActionState(
        updateDeliveryPricingRateAction,
        initialState,
    );
    const [townshipId, setTownshipId] = useState(rate.townshipId);
    const [merchantId, setMerchantId] = useState(rate.merchantId ?? "");

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                    Edit
                </Button>
            </SheetTrigger>

            <SheetContent
                side="bottom"
                className="max-h-[90vh] rounded-t-2xl border-x-0 border-b-0"
            >
                <form action={action} className="flex h-full flex-col gap-0">
                    <input type="hidden" name="rateId" value={rate.id} />

                    <SheetHeader className="pr-8">
                        <SheetTitle>Edit Rate</SheetTitle>
                        <SheetDescription>
                            Update the scope or fee rules for this pricing row.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 space-y-4 overflow-y-auto py-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor={`edit-rate-township-${rate.id}`}>
                                    Recipient Township *
                                </Label>
                                <SearchableCombobox
                                    id={`edit-rate-township-${rate.id}`}
                                    name="townshipId"
                                    value={townshipId}
                                    onValueChange={setTownshipId}
                                    options={townships.map((township) => ({
                                        value: township.id,
                                        label: township.label,
                                    }))}
                                    placeholder="Search township"
                                    emptyLabel="No township found."
                                    required
                                    invalid={Boolean(state.fieldErrors?.townshipId?.[0])}
                                />
                                <FormFieldError message={state.fieldErrors?.townshipId?.[0]} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`edit-rate-merchant-${rate.id}`}>
                                    Merchant Override
                                </Label>
                                <SearchableCombobox
                                    id={`edit-rate-merchant-${rate.id}`}
                                    name="merchantId"
                                    value={merchantId}
                                    onValueChange={setMerchantId}
                                    options={merchants.map((merchant) => ({
                                        value: merchant.id,
                                        label: merchant.label,
                                    }))}
                                    placeholder="Global rate when empty"
                                    emptyLabel="No merchant found."
                                    allowClear
                                    invalid={Boolean(state.fieldErrors?.merchantId?.[0])}
                                />
                                <FormFieldError message={state.fieldErrors?.merchantId?.[0]} />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div className="grid gap-2">
                                <Label htmlFor={`edit-base-weight-${rate.id}`}>
                                    Base Weight (kg) *
                                </Label>
                                <Input
                                    id={`edit-base-weight-${rate.id}`}
                                    name="baseWeightKg"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    defaultValue={rate.baseWeightKg}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`edit-base-fee-${rate.id}`}>Base Fee (Ks) *</Label>
                                <Input
                                    id={`edit-base-fee-${rate.id}`}
                                    name="baseFee"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={rate.baseFee}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`edit-extra-unit-${rate.id}`}>
                                    Extra Weight Unit (kg) *
                                </Label>
                                <Input
                                    id={`edit-extra-unit-${rate.id}`}
                                    name="extraWeightUnitKg"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    defaultValue={rate.extraWeightUnitKg}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`edit-extra-fee-${rate.id}`}>
                                    Extra Weight Fee (Ks) *
                                </Label>
                                <Input
                                    id={`edit-extra-fee-${rate.id}`}
                                    name="extraWeightFee"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={rate.extraWeightFee}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`edit-divisor-${rate.id}`}>
                                    Volumetric Divisor *
                                </Label>
                                <Input
                                    id={`edit-divisor-${rate.id}`}
                                    name="volumetricDivisor"
                                    type="number"
                                    min="1"
                                    step="1"
                                    defaultValue={rate.volumetricDivisor}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`edit-cod-percent-${rate.id}`}>
                                    COD Fee Percent
                                </Label>
                                <Input
                                    id={`edit-cod-percent-${rate.id}`}
                                    name="codFeePercent"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    defaultValue={rate.codFeePercent}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`edit-return-percent-${rate.id}`}>
                                    Return Fee Percent
                                </Label>
                                <Input
                                    id={`edit-return-percent-${rate.id}`}
                                    name="returnFeePercent"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    defaultValue={rate.returnFeePercent}
                                    required
                                />
                            </div>
                        </div>

                        <label
                            htmlFor={`edit-active-${rate.id}`}
                            className="flex items-center gap-2 text-sm"
                        >
                            <input
                                id={`edit-active-${rate.id}`}
                                type="checkbox"
                                name="isActive"
                                defaultChecked={rate.isActive}
                                className="h-4 w-4"
                            />
                            Rate is active
                        </label>

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
                    </div>

                    <SheetFooter className="mt-auto border-t pt-4">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Saving..." : "Save"}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
