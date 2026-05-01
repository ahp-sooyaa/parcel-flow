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
import { createDeliveryPricingRateAction } from "@/features/delivery-pricing/server/actions";
import { cn } from "@/lib/utils";

const initialState = {
    ok: true,
    message: "",
    fieldErrors: undefined,
};

type CreateDeliveryPricingRateFormProps = {
    merchants: {
        id: string;
        label: string;
    }[];
    townships: {
        id: string;
        label: string;
    }[];
};

export function CreateDeliveryPricingRateForm({
    merchants,
    townships,
}: Readonly<CreateDeliveryPricingRateFormProps>) {
    const [state, action, isPending] = useActionState(
        createDeliveryPricingRateAction,
        initialState,
    );
    const [townshipId, setTownshipId] = useState("");
    const [merchantId, setMerchantId] = useState("");

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button size="sm">Create Pricing Rate</Button>
            </SheetTrigger>

            <SheetContent
                side="bottom"
                className="max-h-[90vh] rounded-t-2xl border-x-0 border-b-0"
            >
                <form action={action} className="flex h-full flex-col gap-0">
                    <SheetHeader className="pr-8">
                        <SheetTitle>Create Pricing Rate</SheetTitle>
                        <SheetDescription>
                            Add a global township rate or a merchant-specific contract override.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 space-y-5 overflow-y-auto py-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="create-delivery-pricing-township">
                                    Recipient Township *
                                </Label>
                                <SearchableCombobox
                                    id="create-delivery-pricing-township"
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
                                <Label htmlFor="create-delivery-pricing-merchant">
                                    Merchant Override
                                </Label>
                                <SearchableCombobox
                                    id="create-delivery-pricing-merchant"
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
                                <p className="text-xs text-muted-foreground">
                                    Leave empty to create a township-wide global rate.
                                </p>
                                <FormFieldError message={state.fieldErrors?.merchantId?.[0]} />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div className="grid gap-2">
                                <Label htmlFor="create-base-weight-kg">Base Weight (kg) *</Label>
                                <Input
                                    id="create-base-weight-kg"
                                    name="baseWeightKg"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    defaultValue="1.00"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="create-base-fee">Base Fee (Ks) *</Label>
                                <Input
                                    id="create-base-fee"
                                    name="baseFee"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue="0.00"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="create-extra-weight-unit">
                                    Extra Weight Unit (kg) *
                                </Label>
                                <Input
                                    id="create-extra-weight-unit"
                                    name="extraWeightUnitKg"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    defaultValue="0.50"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="create-extra-weight-fee">
                                    Extra Weight Fee (Ks) *
                                </Label>
                                <Input
                                    id="create-extra-weight-fee"
                                    name="extraWeightFee"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue="0.00"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="create-volumetric-divisor">
                                    Volumetric Divisor *
                                </Label>
                                <Input
                                    id="create-volumetric-divisor"
                                    name="volumetricDivisor"
                                    type="number"
                                    min="1"
                                    step="1"
                                    defaultValue="5000"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="create-cod-fee-percent">COD Fee Percent</Label>
                                <Input
                                    id="create-cod-fee-percent"
                                    name="codFeePercent"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    defaultValue="0.0000"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="create-return-fee-percent">
                                    Return Fee Percent
                                </Label>
                                <Input
                                    id="create-return-fee-percent"
                                    name="returnFeePercent"
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    defaultValue="0.0000"
                                    required
                                />
                            </div>
                        </div>

                        <label
                            htmlFor="create-delivery-pricing-active"
                            className="flex items-center gap-2 text-sm"
                        >
                            <input
                                id="create-delivery-pricing-active"
                                type="checkbox"
                                name="isActive"
                                defaultChecked
                                className="h-4 w-4"
                            />
                            Create as active rate
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
                            {isPending ? "Creating..." : "Create Pricing Rate"}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
