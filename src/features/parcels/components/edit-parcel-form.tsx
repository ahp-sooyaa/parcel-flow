"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ParcelImageList } from "@/features/parcels/components/parcel-image-list";
import { ParcelStatusPill } from "@/features/parcels/components/parcel-status-pill";
import {
    COD_STATUSES,
    COLLECTION_STATUSES,
    DELIVERY_FEE_PAYERS,
    DELIVERY_FEE_STATUSES,
    PARCEL_STATUSES,
    PARCEL_TYPES,
    formatParcelStatusLabel,
} from "@/features/parcels/constants";
import { updateParcelAction } from "@/features/parcels/server/actions";
import { cn } from "@/lib/utils";

type EditParcelFormProps = {
    parcel: {
        id: string;
        parcelCode: string;
        merchantId: string;
        riderId: string | null;
        recipientName: string;
        recipientPhone: string;
        recipientTownshipId: string;
        recipientAddress: string;
        parcelDescription: string;
        packageCount: number;
        specialHandlingNote: string | null;
        estimatedWeightKg: string | null;
        packageWidthCm: string | null;
        packageHeightCm: string | null;
        packageLengthCm: string | null;
        parcelType: (typeof PARCEL_TYPES)[number];
        codAmount: string;
        deliveryFee: string;
        deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
        parcelStatus: (typeof PARCEL_STATUSES)[number];
        deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
        codStatus: (typeof COD_STATUSES)[number];
        collectedAmount: string;
        collectionStatus: (typeof COLLECTION_STATUSES)[number];
        merchantSettlementStatus: "pending" | "in_progress" | "settled";
        merchantSettlementId: string | null;
        riderPayoutStatus: "pending" | "in_progress" | "paid";
        paymentNote: string | null;
        pickupImages: Array<{ key: string; url: string }>;
        proofOfDeliveryImages: Array<{ key: string; url: string }>;
        paymentSlipImages: Array<{ key: string; url: string }>;
    };
    options: {
        merchants: { id: string; label: string }[];
        riders: { id: string; label: string }[];
        townships: { id: string; label: string }[];
    };
    readOnly?: {
        merchantField?: boolean;
        accountingFields?: boolean;
    };
};

const initialState = {
    ok: true,
    message: "",
    fields: undefined,
    fieldErrors: undefined,
};

function buildFormValues(parcel: EditParcelFormProps["parcel"]) {
    return {
        merchantId: parcel.merchantId,
        riderId: parcel.riderId ?? "",
        recipientName: parcel.recipientName,
        recipientPhone: parcel.recipientPhone,
        recipientTownshipId: parcel.recipientTownshipId,
        recipientAddress: parcel.recipientAddress,
        parcelDescription: parcel.parcelDescription,
        packageCount: parcel.packageCount.toString(),
        specialHandlingNote: parcel.specialHandlingNote ?? "",
        estimatedWeightKg: parcel.estimatedWeightKg ?? "",
        packageWidthCm: parcel.packageWidthCm ?? "",
        packageHeightCm: parcel.packageHeightCm ?? "",
        packageLengthCm: parcel.packageLengthCm ?? "",
        parcelType: parcel.parcelType,
        codAmount: parcel.codAmount,
        deliveryFee: parcel.deliveryFee,
        deliveryFeePayer: parcel.deliveryFeePayer,
    };
}

function ReadOnlyValue({
    label,
    value,
}: Readonly<{
    label: string;
    value: string;
}>) {
    return (
        <div className="grid gap-1 rounded-lg border bg-background p-3 text-xs">
            <p className="text-muted-foreground">{label}</p>
            <p className="font-medium">{value}</p>
        </div>
    );
}

export function EditParcelForm({ parcel, options, readOnly }: Readonly<EditParcelFormProps>) {
    const [state, action, isPending] = useActionState(updateParcelAction, initialState);
    const merchants = options.merchants;
    const riders = options.riders;
    const townships = options.townships;
    const merchantFieldReadOnly = readOnly?.merchantField ?? false;
    const accountingFieldsReadOnly = readOnly?.accountingFields ?? false;
    const financialFieldsReadOnly =
        Boolean(parcel.merchantSettlementId) &&
        (parcel.merchantSettlementStatus === "in_progress" ||
            parcel.merchantSettlementStatus === "settled");

    const defaultFields = buildFormValues(parcel);
    const fields: ReturnType<typeof buildFormValues> = { ...defaultFields, ...state.fields };
    const selectedMerchant = merchants.find((merchant) => merchant.id === fields.merchantId);
    const selectedRider = riders.find((rider) => rider.id === fields.riderId);
    const getFieldError = (fieldName: string) => state.fieldErrors?.[fieldName]?.[0];

    return (
        <form action={action} className="space-y-6">
            <input type="hidden" name="parcelId" value={parcel.id} />

            <section className="space-y-4 rounded-xl border bg-card p-4">
                <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Parcel Details</h2>
                    <p className="text-xs text-muted-foreground">
                        Edit recipient, package, merchant, and rider assignment details.
                    </p>
                </div>

                <ReadOnlyValue label="Parcel Code" value={parcel.parcelCode} />

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="merchant-id">Merchant *</Label>
                        {merchantFieldReadOnly ? (
                            <>
                                <Input
                                    id="merchant-id"
                                    value={selectedMerchant?.label ?? "-"}
                                    readOnly
                                    disabled
                                />
                                <input type="hidden" name="merchantId" value={fields.merchantId} />
                            </>
                        ) : (
                            <select
                                key={fields.merchantId}
                                id="merchant-id"
                                name="merchantId"
                                defaultValue={fields.merchantId}
                                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                required
                            >
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
                        <Label htmlFor="rider-id">Rider (Optional)</Label>
                        {accountingFieldsReadOnly ? (
                            <>
                                <Input
                                    id="rider-id"
                                    value={selectedRider?.label ?? "No rider assigned"}
                                    readOnly
                                    disabled
                                />
                                <input type="hidden" name="riderId" value={fields.riderId} />
                            </>
                        ) : (
                            <select
                                key={fields.riderId}
                                id="rider-id"
                                name="riderId"
                                defaultValue={fields.riderId}
                                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                                <option value="">No rider assigned</option>
                                {riders.map((rider) => (
                                    <option key={rider.id} value={rider.id}>
                                        {rider.label}
                                    </option>
                                ))}
                            </select>
                        )}
                        <FormFieldError message={getFieldError("riderId")} />
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="recipient-name">Recipient Name *</Label>
                        <Input
                            id="recipient-name"
                            name="recipientName"
                            defaultValue={fields.recipientName}
                            required
                        />
                        <FormFieldError message={getFieldError("recipientName")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="recipient-phone">Recipient Phone *</Label>
                        <Input
                            id="recipient-phone"
                            name="recipientPhone"
                            defaultValue={fields.recipientPhone}
                            required
                        />
                        <FormFieldError message={getFieldError("recipientPhone")} />
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="recipient-township-id">Recipient Township *</Label>
                    <select
                        key={fields.recipientTownshipId}
                        id="recipient-township-id"
                        name="recipientTownshipId"
                        defaultValue={fields.recipientTownshipId}
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        required
                    >
                        {townships.map((township) => (
                            <option key={township.id} value={township.id}>
                                {township.label}
                            </option>
                        ))}
                    </select>
                    <FormFieldError message={getFieldError("recipientTownshipId")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="recipient-address">Recipient Address *</Label>
                    <textarea
                        id="recipient-address"
                        name="recipientAddress"
                        rows={3}
                        defaultValue={fields.recipientAddress}
                        required
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <FormFieldError message={getFieldError("recipientAddress")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="parcel-description">Parcel Description *</Label>
                    <textarea
                        id="parcel-description"
                        name="parcelDescription"
                        rows={3}
                        defaultValue={fields.parcelDescription}
                        required
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <FormFieldError message={getFieldError("parcelDescription")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="package-count">Package Count *</Label>
                    <Input
                        id="package-count"
                        name="packageCount"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={fields.packageCount}
                        required
                    />
                    <FormFieldError message={getFieldError("packageCount")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="special-handling-note">Special Handling Note (Optional)</Label>
                    <textarea
                        id="special-handling-note"
                        name="specialHandlingNote"
                        rows={3}
                        defaultValue={fields.specialHandlingNote}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <FormFieldError message={getFieldError("specialHandlingNote")} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="estimated-weight-kg">Estimated Weight (kg)</Label>
                        <Input
                            id="estimated-weight-kg"
                            name="estimatedWeightKg"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={fields.estimatedWeightKg}
                        />
                        <FormFieldError message={getFieldError("estimatedWeightKg")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="package-width-cm">Width (cm)</Label>
                        <Input
                            id="package-width-cm"
                            name="packageWidthCm"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={fields.packageWidthCm}
                        />
                        <FormFieldError message={getFieldError("packageWidthCm")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="package-height-cm">Height (cm)</Label>
                        <Input
                            id="package-height-cm"
                            name="packageHeightCm"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={fields.packageHeightCm}
                        />
                        <FormFieldError message={getFieldError("packageHeightCm")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="package-length-cm">Length (cm)</Label>
                        <Input
                            id="package-length-cm"
                            name="packageLengthCm"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={fields.packageLengthCm}
                        />
                        <FormFieldError message={getFieldError("packageLengthCm")} />
                    </div>
                </div>
            </section>

            <section className="space-y-4 rounded-xl border bg-card p-4">
                <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Collection Setup</h2>
                    <p className="text-xs text-muted-foreground">
                        Edit parcel type, COD amount, delivery fee, and fee payer.
                    </p>
                </div>

                {financialFieldsReadOnly && (
                    <p className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                        Financial fields are locked by merchant settlement.
                    </p>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="parcel-type">Parcel Type *</Label>
                        {financialFieldsReadOnly ? (
                            <>
                                <Input
                                    id="parcel-type"
                                    value={formatParcelStatusLabel(fields.parcelType)}
                                    readOnly
                                    disabled
                                />
                                <input type="hidden" name="parcelType" value={fields.parcelType} />
                            </>
                        ) : (
                            <select
                                key={fields.parcelType}
                                id="parcel-type"
                                name="parcelType"
                                defaultValue={fields.parcelType}
                                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                required
                            >
                                {PARCEL_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {formatParcelStatusLabel(type)}
                                    </option>
                                ))}
                            </select>
                        )}
                        <FormFieldError message={getFieldError("parcelType")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="delivery-fee-payer">Delivery Fee Payer *</Label>
                        {financialFieldsReadOnly ? (
                            <>
                                <Input
                                    id="delivery-fee-payer"
                                    value={formatParcelStatusLabel(fields.deliveryFeePayer)}
                                    readOnly
                                    disabled
                                />
                                <input
                                    type="hidden"
                                    name="deliveryFeePayer"
                                    value={fields.deliveryFeePayer}
                                />
                            </>
                        ) : (
                            <select
                                key={fields.deliveryFeePayer}
                                id="delivery-fee-payer"
                                name="deliveryFeePayer"
                                defaultValue={fields.deliveryFeePayer}
                                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                required
                            >
                                {DELIVERY_FEE_PAYERS.map((value) => (
                                    <option key={value} value={value}>
                                        {formatParcelStatusLabel(value)}
                                    </option>
                                ))}
                            </select>
                        )}
                        <FormFieldError message={getFieldError("deliveryFeePayer")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="cod-amount">COD Amount *</Label>
                        <Input
                            id="cod-amount"
                            name="codAmount"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={fields.codAmount}
                            readOnly={financialFieldsReadOnly}
                            required
                        />
                        <FormFieldError message={getFieldError("codAmount")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="delivery-fee">Delivery Fee *</Label>
                        <Input
                            id="delivery-fee"
                            name="deliveryFee"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={fields.deliveryFee}
                            readOnly={financialFieldsReadOnly}
                            required
                        />
                        <FormFieldError message={getFieldError("deliveryFee")} />
                    </div>
                </div>
            </section>

            <section className="space-y-4 rounded-xl border bg-card p-4">
                <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Parcel Images</h2>
                    <p className="text-xs text-muted-foreground">
                        New uploads are appended. Existing images are kept.
                    </p>
                </div>

                <ParcelImageList title="Pickup Images" images={parcel.pickupImages} />
                <div className="grid gap-2">
                    <Label htmlFor="pickup-images">Add Pickup Images</Label>
                    <Input
                        id="pickup-images"
                        name="pickupImages"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                    />
                    <FormFieldError message={getFieldError("pickupImages")} />
                </div>

                <ParcelImageList
                    title="Proof Of Delivery Images"
                    images={parcel.proofOfDeliveryImages}
                />
                <div className="grid gap-2">
                    <Label htmlFor="proof-of-delivery-images">Add Proof Of Delivery Images</Label>
                    <Input
                        id="proof-of-delivery-images"
                        name="proofOfDeliveryImages"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                    />
                    <FormFieldError message={getFieldError("proofOfDeliveryImages")} />
                </div>

                {!accountingFieldsReadOnly && (
                    <>
                        <ParcelImageList
                            title="Payment Slip Images"
                            images={parcel.paymentSlipImages}
                        />
                        <div className="grid gap-2">
                            <Label htmlFor="payment-slip-images">Add Payment Slip Images</Label>
                            <Input
                                id="payment-slip-images"
                                name="paymentSlipImages"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                            />
                            <FormFieldError message={getFieldError("paymentSlipImages")} />
                        </div>
                    </>
                )}
            </section>

            <section className="space-y-4 rounded-xl border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <h2 className="text-sm font-semibold">Payment State</h2>
                        <p className="text-xs text-muted-foreground">
                            Status changes are handled from parcel operations.
                        </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/parcels/${parcel.id}#operations`}>
                            Open Operations
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-1">
                        <p className="text-xs text-muted-foreground">Parcel Status</p>
                        <ParcelStatusPill value={parcel.parcelStatus} />
                    </div>
                    <div className="grid gap-1">
                        <p className="text-xs text-muted-foreground">COD Status</p>
                        <ParcelStatusPill value={parcel.codStatus} />
                    </div>
                    <div className="grid gap-1">
                        <p className="text-xs text-muted-foreground">Collection Status</p>
                        <ParcelStatusPill value={parcel.collectionStatus} />
                    </div>
                    <div className="grid gap-1">
                        <p className="text-xs text-muted-foreground">Delivery Fee Status</p>
                        <ParcelStatusPill value={parcel.deliveryFeeStatus} />
                    </div>
                    <ReadOnlyValue label="Collected Amount" value={parcel.collectedAmount} />
                    <ReadOnlyValue
                        label="Merchant Settlement"
                        value={
                            parcel.merchantSettlementId
                                ? `${formatParcelStatusLabel(parcel.merchantSettlementStatus)} (${parcel.merchantSettlementId})`
                                : formatParcelStatusLabel(parcel.merchantSettlementStatus)
                        }
                    />
                    <ReadOnlyValue
                        label="Rider Payout"
                        value={formatParcelStatusLabel(parcel.riderPayoutStatus)}
                    />
                    <ReadOnlyValue label="Payment Note" value={parcel.paymentNote ?? "-"} />
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
                {isPending ? "Saving..." : "Save Parcel Details"}
            </Button>
        </form>
    );
}
