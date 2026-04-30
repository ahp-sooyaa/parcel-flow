"use client";

import { CheckCircle2Icon, ImageIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button, buttonVariants } from "@/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { ParcelImageList } from "@/features/parcels/components/parcel-image-list";
import { ParcelStatusPill } from "@/features/parcels/components/parcel-status-pill";
import {
    COD_STATUSES,
    COLLECTION_STATUSES,
    DELIVERY_FEE_PAYERS,
    DELIVERY_FEE_PAYMENT_PLANS,
    DELIVERY_FEE_STATUSES,
    PARCEL_STATUSES,
    PARCEL_TYPES,
    formatParcelStatusLabel,
    getDeliveryFeePaymentPlanOptions,
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
        isLargeItem: boolean;
        packageWidthCm: string | null;
        packageHeightCm: string | null;
        packageLengthCm: string | null;
        parcelType: (typeof PARCEL_TYPES)[number];
        codAmount: string;
        deliveryFee: string;
        deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
        deliveryFeePaymentPlan: (typeof DELIVERY_FEE_PAYMENT_PLANS)[number] | null;
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

type ParcelType = (typeof PARCEL_TYPES)[number];
type DeliveryFeePayer = (typeof DELIVERY_FEE_PAYERS)[number];
type DeliveryFeePaymentPlan = (typeof DELIVERY_FEE_PAYMENT_PLANS)[number];
type DeliveryFeePaymentPlanValue = DeliveryFeePaymentPlan | "";

const textareaClassName =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const deliveryFeePaymentPlanCopy: Record<
    DeliveryFeePaymentPlan,
    { title: string; description: string }
> = {
    receiver_collect_on_delivery: {
        title: "Collect on Delivery",
        description: "Receiver pays the delivery fee during delivery.",
    },
    merchant_prepaid_bank_transfer: {
        title: "Prepaid Bank Transfer",
        description: "Merchant pays by bank transfer before pickup.",
    },
    merchant_cash_on_pickup: {
        title: "Cash on Pickup",
        description: "Merchant pays cash to the rider during pickup.",
    },
    merchant_deduct_from_cod_settlement: {
        title: "Deduct from COD Settlement",
        description: "Deduct the delivery fee from each COD parcel's settlement.",
    },
    merchant_bill_later: {
        title: "Bill Later",
        description: "Bill the merchant separately at a later time.",
    },
};

function getSafeParcelTypeValue(value: string | undefined) {
    if (PARCEL_TYPES.includes(value as ParcelType)) {
        return value as ParcelType;
    }

    return "cod";
}

function getSafeDeliveryFeePayerValue(value: string | undefined) {
    if (DELIVERY_FEE_PAYERS.includes(value as DeliveryFeePayer)) {
        return value as DeliveryFeePayer;
    }

    return "receiver";
}

function getSafeIsLargeItemValue(value: string | undefined) {
    return value === "true";
}

function getSafePaymentPlanValue(
    value: string | null | undefined,
    options: readonly DeliveryFeePaymentPlan[],
): DeliveryFeePaymentPlanValue {
    if (!value) {
        return "";
    }

    if (options.includes(value as DeliveryFeePaymentPlan)) {
        return value as DeliveryFeePaymentPlan;
    }

    return options[0] ?? "";
}

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
        isLargeItem: parcel.isLargeItem ? "true" : "false",
        packageWidthCm: parcel.packageWidthCm ?? "",
        packageHeightCm: parcel.packageHeightCm ?? "",
        packageLengthCm: parcel.packageLengthCm ?? "",
        parcelType: parcel.parcelType,
        codAmount: parcel.codAmount,
        deliveryFee: parcel.deliveryFee,
        deliveryFeePayer: parcel.deliveryFeePayer,
        deliveryFeePaymentPlan: parcel.deliveryFeePaymentPlan ?? "",
    };
}

function SectionHeader({
    step,
    title,
    description,
}: Readonly<{
    step: number;
    title: string;
    description: string;
}>) {
    return (
        <div className="flex items-start gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground ring-1 ring-border">
                {step}
            </div>
            <div className="space-y-1">
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
        </div>
    );
}

function ChoiceCard({
    title,
    description,
    selected,
    onClick,
    disabled = false,
    className,
}: Readonly<{
    title: string;
    description: string;
    selected: boolean;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
}>) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "rounded-xl border bg-background p-4 text-left transition-colors hover:border-foreground/30",
                {
                    "border-foreground/80 bg-foreground/5": selected,
                    "cursor-not-allowed opacity-70 hover:border-input": disabled,
                },
                className,
            )}
            aria-pressed={selected}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>

                <CheckCircle2Icon
                    aria-hidden={!selected}
                    className={cn("mt-0.5 size-4 shrink-0 text-foreground transition-opacity", {
                        "opacity-0": !selected,
                    })}
                />
            </div>
        </button>
    );
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
    const [selectedMerchantId, setSelectedMerchantId] = useState(fields.merchantId);
    const [selectedRiderId, setSelectedRiderId] = useState(fields.riderId);
    const [selectedParcelType, setSelectedParcelType] = useState<ParcelType>(
        getSafeParcelTypeValue(fields.parcelType),
    );
    const [selectedIsLargeItem, setSelectedIsLargeItem] = useState(
        getSafeIsLargeItemValue(fields.isLargeItem),
    );
    const [selectedDeliveryFeePayer, setSelectedDeliveryFeePayer] = useState<DeliveryFeePayer>(
        getSafeDeliveryFeePayerValue(fields.deliveryFeePayer),
    );
    const [selectedDeliveryFeePaymentPlan, setSelectedDeliveryFeePaymentPlan] =
        useState<DeliveryFeePaymentPlanValue>(() =>
            getSafePaymentPlanValue(
                fields.deliveryFeePaymentPlan,
                getDeliveryFeePaymentPlanOptions({
                    parcelType: getSafeParcelTypeValue(fields.parcelType),
                    deliveryFeePayer: getSafeDeliveryFeePayerValue(fields.deliveryFeePayer),
                }),
            ),
        );
    const [paymentSlipFileCount, setPaymentSlipFileCount] = useState(0);

    useEffect(() => {
        const nextParcelType = getSafeParcelTypeValue(fields.parcelType);
        const nextDeliveryFeePayer = getSafeDeliveryFeePayerValue(fields.deliveryFeePayer);
        const nextOptions = getDeliveryFeePaymentPlanOptions({
            parcelType: nextParcelType,
            deliveryFeePayer: nextDeliveryFeePayer,
        });

        setSelectedMerchantId(fields.merchantId);
        setSelectedRiderId(fields.riderId);
        setSelectedParcelType(nextParcelType);
        setSelectedIsLargeItem(getSafeIsLargeItemValue(fields.isLargeItem));
        setSelectedDeliveryFeePayer(nextDeliveryFeePayer);
        setSelectedDeliveryFeePaymentPlan(
            getSafePaymentPlanValue(fields.deliveryFeePaymentPlan, nextOptions),
        );
    }, [
        fields.deliveryFeePayer,
        fields.deliveryFeePaymentPlan,
        fields.isLargeItem,
        fields.merchantId,
        fields.parcelType,
        fields.riderId,
    ]);

    const deliveryFeePaymentPlanOptions = getDeliveryFeePaymentPlanOptions({
        parcelType: selectedParcelType,
        deliveryFeePayer: selectedDeliveryFeePayer,
    });

    useEffect(() => {
        setSelectedDeliveryFeePaymentPlan((current) =>
            getSafePaymentPlanValue(current, deliveryFeePaymentPlanOptions),
        );
    }, [selectedDeliveryFeePayer, selectedParcelType]);

    const deliveryFeePaymentPlanValue = getSafePaymentPlanValue(
        selectedDeliveryFeePaymentPlan,
        deliveryFeePaymentPlanOptions,
    );
    const allowBlankDeliveryFeePaymentPlan = parcel.deliveryFeePaymentPlan === null;
    const showPaymentSlipField = deliveryFeePaymentPlanValue === "merchant_prepaid_bank_transfer";
    const selectedMerchant = merchants.find((merchant) => merchant.id === selectedMerchantId);
    const selectedRider = riders.find((rider) => rider.id === selectedRiderId);
    const merchantOptions = merchants.map((merchant) => ({
        value: merchant.id,
        label: merchant.label,
    }));
    const riderOptions = riders.map((rider) => ({
        value: rider.id,
        label: rider.label,
    }));
    const getFieldError = (fieldName: string) => state.fieldErrors?.[fieldName]?.[0];

    useEffect(() => {
        if (!showPaymentSlipField) {
            setPaymentSlipFileCount(0);
        }
    }, [showPaymentSlipField]);

    return (
        <form action={action} className="space-y-5">
            <input type="hidden" name="parcelId" value={parcel.id} />
            <input type="hidden" name="packageCount" value={fields.packageCount} />

            <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
                <SectionHeader
                    step={1}
                    title="People"
                    description="Assign the merchant and rider, then update the recipient delivery details."
                />

                <div className="grid gap-4 md:grid-cols-2">
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
                                <input type="hidden" name="merchantId" value={selectedMerchantId} />
                            </>
                        ) : (
                            <SearchableCombobox
                                id="merchantId"
                                name="merchantId"
                                value={selectedMerchantId}
                                onValueChange={setSelectedMerchantId}
                                options={merchantOptions}
                                placeholder="Search merchant"
                                emptyLabel="No merchant found."
                                required
                                invalid={Boolean(getFieldError("merchantId"))}
                            />
                        )}
                        <FormFieldError message={getFieldError("merchantId")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="riderId">Rider (Optional)</Label>
                        {accountingFieldsReadOnly ? (
                            <>
                                <Input
                                    id="riderId"
                                    value={selectedRider?.label ?? "No rider assigned"}
                                    readOnly
                                    disabled
                                />
                                <input type="hidden" name="riderId" value={selectedRiderId} />
                            </>
                        ) : (
                            <SearchableCombobox
                                id="riderId"
                                name="riderId"
                                value={selectedRiderId}
                                onValueChange={setSelectedRiderId}
                                options={riderOptions}
                                placeholder="Search rider"
                                emptyLabel="No rider found."
                                allowClear
                                invalid={Boolean(getFieldError("riderId"))}
                            />
                        )}
                        <FormFieldError message={getFieldError("riderId")} />
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="recipientName">Recipient Name *</Label>
                        <Input
                            id="recipientName"
                            name="recipientName"
                            placeholder="Receiver full name"
                            defaultValue={fields.recipientName}
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
                            defaultValue={fields.recipientPhone}
                            required
                        />
                        <FormFieldError message={getFieldError("recipientPhone")} />
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="recipientTownshipId">Recipient Township *</Label>
                    <select
                        key={fields.recipientTownshipId}
                        id="recipientTownshipId"
                        name="recipientTownshipId"
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        defaultValue={fields.recipientTownshipId}
                        required
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
                        defaultValue={fields.recipientAddress}
                        required
                        className={textareaClassName}
                    />
                    <FormFieldError message={getFieldError("recipientAddress")} />
                </div>
            </section>

            <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
                <SectionHeader
                    step={2}
                    title="Billing"
                    description="Set who pays the delivery fee, choose the payment plan, and append transfer proof when needed."
                />

                {financialFieldsReadOnly ? (
                    <p className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                        Financial fields are locked by merchant settlement.
                    </p>
                ) : null}

                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label>Delivery Fee Payer *</Label>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {DELIVERY_FEE_PAYERS.map((value) => (
                                <ChoiceCard
                                    key={value}
                                    title={formatParcelStatusLabel(value)}
                                    description={
                                        value === "receiver"
                                            ? "Receiver pays the delivery fee during delivery."
                                            : "Merchant covers the delivery fee using the selected payment plan."
                                    }
                                    selected={selectedDeliveryFeePayer === value}
                                    onClick={() => setSelectedDeliveryFeePayer(value)}
                                    disabled={financialFieldsReadOnly}
                                    className="h-[90px]"
                                />
                            ))}
                        </div>
                        <input
                            type="hidden"
                            id="deliveryFeePayer"
                            name="deliveryFeePayer"
                            value={selectedDeliveryFeePayer}
                        />
                        <FormFieldError message={getFieldError("deliveryFeePayer")} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Delivery Fee Payment Plan</Label>
                        <div className="grid gap-3 md:grid-cols-2">
                            {deliveryFeePaymentPlanOptions.map((value) => {
                                const copy = deliveryFeePaymentPlanCopy[value];

                                return (
                                    <ChoiceCard
                                        key={value}
                                        title={copy.title}
                                        description={copy.description}
                                        selected={deliveryFeePaymentPlanValue === value}
                                        onClick={() => setSelectedDeliveryFeePaymentPlan(value)}
                                        disabled={financialFieldsReadOnly}
                                        className="h-[90px]"
                                    />
                                );
                            })}
                        </div>
                        <input
                            type="hidden"
                            id="deliveryFeePaymentPlan"
                            name="deliveryFeePaymentPlan"
                            value={deliveryFeePaymentPlanValue}
                        />
                        {!deliveryFeePaymentPlanValue && allowBlankDeliveryFeePaymentPlan ? (
                            <p className="text-xs text-muted-foreground">
                                No delivery fee payment plan has been recorded yet.
                            </p>
                        ) : null}
                        <FormFieldError message={getFieldError("deliveryFeePaymentPlan")} />
                    </div>
                </div>

                {!accountingFieldsReadOnly ? (
                    <>
                        <ParcelImageList
                            title="Payment Slip Images"
                            images={parcel.paymentSlipImages}
                        />

                        {showPaymentSlipField ? (
                            <div className="grid gap-2">
                                <Label>Payment Slip Images</Label>
                                <input
                                    id="paymentSlipImages"
                                    name="paymentSlipImages"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    multiple
                                    className="sr-only hidden"
                                    onChange={(event) =>
                                        setPaymentSlipFileCount(event.target.files?.length ?? 0)
                                    }
                                />
                                <Empty className="border bg-background">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <ImageIcon className="size-5" />
                                        </EmptyMedia>
                                        <EmptyTitle>
                                            {paymentSlipFileCount > 0
                                                ? `${paymentSlipFileCount} payment slip image${paymentSlipFileCount === 1 ? "" : "s"} selected`
                                                : "Upload Payment Slip Images"}
                                        </EmptyTitle>
                                        <EmptyDescription>
                                            Add JPG, PNG, or WEBP images. Existing payment slips are
                                            kept and new uploads are appended to this parcel.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        <label
                                            htmlFor="paymentSlipImages"
                                            className={cn(
                                                buttonVariants({ variant: "outline" }),
                                                "cursor-pointer",
                                            )}
                                        >
                                            <UploadIcon className="size-4" />
                                            {paymentSlipFileCount > 0
                                                ? "Change Images"
                                                : "Choose Images"}
                                        </label>
                                    </EmptyContent>
                                </Empty>
                                <FormFieldError message={getFieldError("paymentSlipImages")} />
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Payment slips are only available for prepaid bank transfer parcels.
                            </p>
                        )}
                    </>
                ) : null}
            </section>

            <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
                <SectionHeader
                    step={3}
                    title="Parcel Details"
                    description="Edit the single parcel record details. Package count stays fixed and is hidden in edit mode."
                />

                <ReadOnlyValue label="Parcel Code" value={parcel.parcelCode} />

                <div className="grid gap-2">
                    <Label>Parcel Type *</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {PARCEL_TYPES.map((type) => (
                            <ChoiceCard
                                key={type}
                                title={formatParcelStatusLabel(type)}
                                description={
                                    type === "cod"
                                        ? "Collect COD cash from the recipient on delivery."
                                        : "No COD collection. COD amount will stay at 0."
                                }
                                selected={selectedParcelType === type}
                                onClick={() => setSelectedParcelType(type)}
                                disabled={financialFieldsReadOnly}
                            />
                        ))}
                    </div>
                    <input type="hidden" name="parcelType" value={selectedParcelType} />
                    <FormFieldError message={getFieldError("parcelType")} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="parcelDescription">Parcel Description *</Label>
                    <textarea
                        id="parcelDescription"
                        name="parcelDescription"
                        rows={3}
                        defaultValue={fields.parcelDescription}
                        required
                        className={textareaClassName}
                    />
                    <FormFieldError message={getFieldError("parcelDescription")} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="estimatedWeightKg">Weight (kg) *</Label>
                        <Input
                            id="estimatedWeightKg"
                            name="estimatedWeightKg"
                            type="number"
                            min="0.01"
                            step="0.01"
                            defaultValue={fields.estimatedWeightKg}
                            required
                        />
                        <FormFieldError message={getFieldError("estimatedWeightKg")} />
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                        <Label>Item Size</Label>
                        <ChoiceCard
                            title="Large Item"
                            description="Show length, width, and height for bulky parcels. Standard items save as 1 x 1 x 1 cm."
                            selected={selectedIsLargeItem}
                            onClick={() => setSelectedIsLargeItem((current) => !current)}
                            className="h-full"
                        />
                        <input
                            type="hidden"
                            name="isLargeItem"
                            value={selectedIsLargeItem ? "true" : "false"}
                        />
                        <FormFieldError message={getFieldError("isLargeItem")} />
                    </div>

                    <div
                        className={cn("grid grid-rows-[min-content] items-start gap-2", {
                            hidden: !selectedIsLargeItem,
                        })}
                        aria-hidden={!selectedIsLargeItem}
                    >
                        <Label>Dimensions (cm) *</Label>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
                            <div className="grid gap-2">
                                <Input
                                    id="packageLengthCm"
                                    name="packageLengthCm"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="L"
                                    aria-label="Length (cm)"
                                    defaultValue={fields.packageLengthCm}
                                />
                                <FormFieldError message={getFieldError("packageLengthCm")} />
                            </div>
                            <span className="flex h-8 items-center justify-center text-sm text-muted-foreground">
                                x
                            </span>
                            <div className="grid gap-2">
                                <Input
                                    id="packageWidthCm"
                                    name="packageWidthCm"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="W"
                                    aria-label="Width (cm)"
                                    defaultValue={fields.packageWidthCm}
                                />
                                <FormFieldError message={getFieldError("packageWidthCm")} />
                            </div>
                            <span className="flex h-8 items-center justify-center text-sm text-muted-foreground">
                                x
                            </span>
                            <div className="grid gap-2">
                                <Input
                                    id="packageHeightCm"
                                    name="packageHeightCm"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="H"
                                    aria-label="Height (cm)"
                                    defaultValue={fields.packageHeightCm}
                                />
                                <FormFieldError message={getFieldError("packageHeightCm")} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="deliveryFee">Delivery Fee *</Label>
                        <InputGroup>
                            <InputGroupInput
                                id="deliveryFee"
                                name="deliveryFee"
                                type="number"
                                min="0.01"
                                step="0.01"
                                defaultValue={fields.deliveryFee}
                                readOnly={financialFieldsReadOnly}
                                required
                            />
                            <InputGroupAddon align="inline-start">
                                <InputGroupText>Ks</InputGroupText>
                            </InputGroupAddon>
                        </InputGroup>
                        <FormFieldError message={getFieldError("deliveryFee")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="codAmount">COD Amount *</Label>
                        <InputGroup>
                            {selectedParcelType === "non_cod" && !financialFieldsReadOnly ? (
                                <>
                                    <input type="hidden" name="codAmount" value="0" />
                                    <InputGroupInput
                                        id="codAmount"
                                        value="0"
                                        readOnly
                                        disabled
                                        aria-readonly="true"
                                    />
                                </>
                            ) : (
                                <InputGroupInput
                                    id="codAmount"
                                    name="codAmount"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    defaultValue={fields.codAmount}
                                    readOnly={financialFieldsReadOnly}
                                    required
                                />
                            )}
                            <InputGroupAddon align="inline-start">
                                <InputGroupText>Ks</InputGroupText>
                            </InputGroupAddon>
                        </InputGroup>
                        {selectedParcelType === "non_cod" ? (
                            <p className="text-xs text-muted-foreground">
                                Non-COD parcels do not collect COD. COD amount will be submitted as
                                0.
                            </p>
                        ) : null}
                        <FormFieldError message={getFieldError("codAmount")} />
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="specialHandlingNote">Special Handling Note (Optional)</Label>
                    <textarea
                        id="specialHandlingNote"
                        name="specialHandlingNote"
                        rows={3}
                        defaultValue={fields.specialHandlingNote}
                        className={textareaClassName}
                    />
                    <FormFieldError message={getFieldError("specialHandlingNote")} />
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
                    <Label htmlFor="pickupImages">Add Pickup Images</Label>
                    <Input
                        id="pickupImages"
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
                    <Label htmlFor="proofOfDeliveryImages">Add Proof Of Delivery Images</Label>
                    <Input
                        id="proofOfDeliveryImages"
                        name="proofOfDeliveryImages"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                    />
                    <FormFieldError message={getFieldError("proofOfDeliveryImages")} />
                </div>
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

            {state.message ? (
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
            ) : null}

            <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Parcel Details"}
            </Button>
        </form>
    );
}
