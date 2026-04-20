"use client";

import { useActionState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    DEFAULT_CREATE_PARCEL_STATE,
    DELIVERY_FEE_PAYERS,
    PARCEL_TYPES,
} from "@/features/parcels/constants";
import { createParcelAction } from "@/features/parcels/server/actions";
import { cn } from "@/lib/utils";

type CreateParcelFormProps = {
    options: {
        merchants: { id: string; label: string }[];
        riders: { id: string; label: string }[];
        townships: { id: string; label: string }[];
    };
    readOnly?: {
        merchantField?: boolean;
        hidePaymentSlipField?: boolean;
    };
};

const initialState = {
    ok: true,
    message: "",
    parcelId: undefined,
    fields: undefined,
    fieldErrors: undefined,
};

export function CreateParcelForm({ options, readOnly }: Readonly<CreateParcelFormProps>) {
    const [state, action, isPending] = useActionState(createParcelAction, initialState);
    const merchants = options.merchants;
    const riders = options.riders;
    const townships = options.townships;
    const merchantFieldReadOnly = readOnly?.merchantField ?? false;
    const hidePaymentSlipField = readOnly?.hidePaymentSlipField ?? false;
    const selectedMerchant = merchants.find(
        (merchant) => merchant.id === (state.fields?.merchantId ?? ""),
    );
    const defaultMerchantId = state.fields?.merchantId ?? merchants[0]?.id ?? "";
    const getFieldError = (fieldName: string) => state.fieldErrors?.[fieldName]?.[0];

    return (
        <form action={action} className="space-y-6">
            <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
                <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Parcel Info</h2>
                    <p className="text-xs text-muted-foreground">
                        Core parcel, receiver, and package fields.
                    </p>
                </div>

                <p className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                    Parcel code is generated automatically after create.
                </p>

                <div className="grid gap-2">
                    <Label htmlFor="merchantId">Merchant *</Label>
                    {merchantFieldReadOnly ? (
                        <>
                            <Input
                                id="merchantId"
                                value={selectedMerchant?.label ?? merchants[0]?.label ?? "-"}
                                readOnly
                                disabled
                            />
                            <input type="hidden" name="merchantId" value={defaultMerchantId} />
                        </>
                    ) : (
                        <select
                            key={state.fields?.merchantId ?? ""}
                            id="merchantId"
                            name="merchantId"
                            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            required
                            defaultValue={state.fields?.merchantId ?? ""}
                        >
                            <option value="" disabled>
                                Select merchant
                            </option>
                            {merchants.map((merchant) => (
                                <option key={merchant.id} value={merchant.id}>
                                    {merchant.label}
                                </option>
                            ))}
                        </select>
                    )}
                    <FormFieldError message={getFieldError("merchantId")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="riderId">Rider (Optional)</Label>
                    <select
                        key={state.fields?.riderId ?? ""}
                        id="riderId"
                        name="riderId"
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        defaultValue={state.fields?.riderId ?? ""}
                    >
                        <option value="">No rider assigned</option>
                        {riders.map((rider) => (
                            <option key={rider.id} value={rider.id}>
                                {rider.label}
                            </option>
                        ))}
                    </select>
                    <FormFieldError message={getFieldError("riderId")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="recipientName">Recipient Name *</Label>
                    <Input
                        id="recipientName"
                        name="recipientName"
                        placeholder="Receiver full name"
                        defaultValue={state.fields?.recipientName}
                        required
                    />
                    <FormFieldError message={getFieldError("recipientName")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="recipientPhone">Recipient Phone *</Label>
                    <Input
                        id="recipientPhone"
                        name="recipientPhone"
                        placeholder="09xxxxxxxxx"
                        defaultValue={state.fields?.recipientPhone}
                        required
                    />
                    <FormFieldError message={getFieldError("recipientPhone")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="recipientTownshipId">Recipient Township *</Label>
                    <select
                        key={state.fields?.recipientTownshipId ?? ""}
                        id="recipientTownshipId"
                        name="recipientTownshipId"
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        required
                        defaultValue={state.fields?.recipientTownshipId ?? ""}
                    >
                        <option value="" disabled>
                            Select township
                        </option>
                        {townships.map((township) => (
                            <option key={township.id} value={township.id}>
                                {township.label}
                            </option>
                        ))}
                    </select>
                    <FormFieldError message={getFieldError("recipientTownshipId")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="recipientAddress">Recipient Address *</Label>
                    <textarea
                        id="recipientAddress"
                        name="recipientAddress"
                        rows={3}
                        defaultValue={state.fields?.recipientAddress}
                        required
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <FormFieldError message={getFieldError("recipientAddress")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="parcelDescription">Parcel Description *</Label>
                    <textarea
                        id="parcelDescription"
                        name="parcelDescription"
                        rows={3}
                        defaultValue={state.fields?.parcelDescription}
                        required
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <FormFieldError message={getFieldError("parcelDescription")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="packageCount">Package Count *</Label>
                    <Input
                        id="packageCount"
                        name="packageCount"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={state.fields?.packageCount ?? 1}
                        required
                    />
                    <FormFieldError message={getFieldError("packageCount")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="specialHandlingNote">Special Handling Note (Optional)</Label>
                    <textarea
                        id="specialHandlingNote"
                        name="specialHandlingNote"
                        rows={3}
                        defaultValue={state.fields?.specialHandlingNote}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <FormFieldError message={getFieldError("specialHandlingNote")} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="estimatedWeightKg">Estimated Weight (kg)</Label>
                        <Input
                            id="estimatedWeightKg"
                            name="estimatedWeightKg"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={state.fields?.estimatedWeightKg}
                        />
                        <FormFieldError message={getFieldError("estimatedWeightKg")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="packageWidthCm">Width (cm)</Label>
                        <Input
                            id="packageWidthCm"
                            name="packageWidthCm"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={state.fields?.packageWidthCm}
                        />
                        <FormFieldError message={getFieldError("packageWidthCm")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="packageHeightCm">Height (cm)</Label>
                        <Input
                            id="packageHeightCm"
                            name="packageHeightCm"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={state.fields?.packageHeightCm}
                        />
                        <FormFieldError message={getFieldError("packageHeightCm")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="packageLengthCm">Length (cm)</Label>
                        <Input
                            id="packageLengthCm"
                            name="packageLengthCm"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={state.fields?.packageLengthCm}
                        />
                        <FormFieldError message={getFieldError("packageLengthCm")} />
                    </div>
                </div>
            </section>

            <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
                <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Parcel Images</h2>
                    <p className="text-xs text-muted-foreground">
                        JPG, PNG, or WebP only. Up to 5 files per field, 5 MB each.
                    </p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="pickupImages">Pickup Images</Label>
                    <Input
                        id="pickupImages"
                        name="pickupImages"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                    />
                    <FormFieldError message={getFieldError("pickupImages")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="proofOfDeliveryImages">Proof Of Delivery Images</Label>
                    <Input
                        id="proofOfDeliveryImages"
                        name="proofOfDeliveryImages"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                    />
                    <FormFieldError message={getFieldError("proofOfDeliveryImages")} />
                </div>

                {!hidePaymentSlipField && (
                    <div className="grid gap-2">
                        <Label htmlFor="paymentSlipImages">Payment Slip Images</Label>
                        <Input
                            id="paymentSlipImages"
                            name="paymentSlipImages"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                        />
                        <FormFieldError message={getFieldError("paymentSlipImages")} />
                    </div>
                )}
            </section>

            <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
                <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Payment Record</h2>
                    <p className="text-xs text-muted-foreground">
                        Parcel and payment fields are submitted together in one transaction.
                    </p>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="parcelType">Parcel Type *</Label>
                    <select
                        key={state.fields?.parcelType ?? ""}
                        id="parcelType"
                        name="parcelType"
                        defaultValue={state.fields?.parcelType ?? ""}
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        required
                    >
                        <option value="" disabled>
                            Select parcel type
                        </option>
                        {PARCEL_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                    <FormFieldError message={getFieldError("parcelType")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="codAmount">COD Amount *</Label>
                    <Input
                        id="codAmount"
                        name="codAmount"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={state.fields?.codAmount ?? 0}
                        required
                    />
                    <FormFieldError message={getFieldError("codAmount")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="deliveryFee">Delivery Fee *</Label>
                    <Input
                        id="deliveryFee"
                        name="deliveryFee"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={state.fields?.deliveryFee ?? 0}
                        required
                    />
                    <FormFieldError message={getFieldError("deliveryFee")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="deliveryFeePayer">Delivery Fee Payer *</Label>
                    <select
                        key={
                            state.fields?.deliveryFeePayer ??
                            DEFAULT_CREATE_PARCEL_STATE.deliveryFeePayer
                        }
                        id="deliveryFeePayer"
                        name="deliveryFeePayer"
                        defaultValue={
                            state.fields?.deliveryFeePayer ??
                            DEFAULT_CREATE_PARCEL_STATE.deliveryFeePayer
                        }
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        required
                    >
                        <option value="" disabled>
                            Select delivery fee payer
                        </option>
                        {DELIVERY_FEE_PAYERS.map((value) => (
                            <option key={value} value={value}>
                                {value}
                            </option>
                        ))}
                    </select>
                    <FormFieldError message={getFieldError("deliveryFeePayer")} />
                </div>

                <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                    Delivery fee status starts as{" "}
                    <span className="font-medium text-foreground">unpaid</span> on create. Update it
                    later when payment is actually collected, billed, waived, or deducted.
                </div>

                <div className="space-y-2 rounded-lg border bg-background p-3 text-xs">
                    <p className="font-medium">Default states applied on create</p>
                    <ul className="space-y-1 text-muted-foreground">
                        <li>Parcel Status: {DEFAULT_CREATE_PARCEL_STATE.parcelStatus}</li>
                        <li>COD Status: {DEFAULT_CREATE_PARCEL_STATE.codStatus}</li>
                        <li>Collection Status: {DEFAULT_CREATE_PARCEL_STATE.collectionStatus}</li>
                        <li>
                            Merchant Settlement Status:{" "}
                            {DEFAULT_CREATE_PARCEL_STATE.merchantSettlementStatus}
                        </li>
                        <li>
                            Rider Payout Status: {DEFAULT_CREATE_PARCEL_STATE.riderPayoutStatus}
                        </li>
                        <li>Delivery Fee Payer: selectable (default: receiver)</li>
                        <li>Delivery Fee Status: unpaid</li>
                    </ul>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="paymentNote">Payment Note (Optional)</Label>
                    <textarea
                        id="paymentNote"
                        name="paymentNote"
                        rows={3}
                        defaultValue={state.fields?.paymentNote}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <FormFieldError message={getFieldError("paymentNote")} />
                </div>
            </section>

            {state.message && (
                <div
                    className={cn("rounded-lg border p-3", {
                        "border-emerald-300 bg-emerald-50": state.ok,
                        "border-red-300 bg-red-50": !state.ok,
                    })}
                >
                    <p
                        className={cn("text-xs", {
                            "text-emerald-800": state.ok,
                            "text-destructive": !state.ok,
                        })}
                    >
                        {state.message}
                    </p>
                </div>
            )}

            <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Parcel"}
            </Button>
        </form>
    );
}
