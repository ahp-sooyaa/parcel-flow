"use client";

import { CheckCircle2Icon, ImageIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
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
import {
    CREATE_PARCEL_MAX_ROWS,
    DEFAULT_CREATE_PARCEL_STATE,
    DELIVERY_FEE_PAYERS,
    DELIVERY_FEE_PAYMENT_PLANS,
    PARCEL_TYPES,
    formatParcelStatusLabel,
    getDeliveryFeePaymentPlanOptions,
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
    };
};

const initialState = {
    ok: true,
    message: "",
    parcelId: undefined,
    fields: undefined,
    fieldErrors: undefined,
};

type ParcelType = (typeof PARCEL_TYPES)[number];
type DeliveryFeePayer = (typeof DELIVERY_FEE_PAYERS)[number];
type DeliveryFeePaymentPlan = (typeof DELIVERY_FEE_PAYMENT_PLANS)[number];
type ParcelRowDraft = {
    id: string;
    parcelType: ParcelType;
};

const textareaClassName =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const parcelRowFieldDefaults = {
    parcelDescription: "",
    packageCount: "1",
    specialHandlingNote: "",
    estimatedWeightKg: "",
    packageWidthCm: "",
    packageHeightCm: "",
    packageLengthCm: "",
    parcelType: "cod",
    codAmount: "0",
    deliveryFee: "0",
} satisfies Record<string, string>;

type ParcelRowFieldName = keyof typeof parcelRowFieldDefaults;

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

function getSafePaymentPlanValue(
    value: string | undefined,
    options: readonly DeliveryFeePaymentPlan[],
) {
    if (options.includes(value as DeliveryFeePaymentPlan)) {
        return value as DeliveryFeePaymentPlan;
    }

    return options[0] ?? DEFAULT_CREATE_PARCEL_STATE.deliveryFeePaymentPlan;
}

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

    return DEFAULT_CREATE_PARCEL_STATE.deliveryFeePayer;
}

function getParcelRowFieldName(rowIndex: number, fieldName: ParcelRowFieldName) {
    return `parcelRows[${rowIndex}].${fieldName}`;
}

function getParcelRowIndexes(fields: Record<string, string> | undefined) {
    if (!fields) {
        return [];
    }

    const rowIndexes = new Set<number>();

    for (const fieldName of Object.keys(fields)) {
        const match = /^parcelRows\[(\d+)\]\./.exec(fieldName);

        if (match) {
            rowIndexes.add(Number(match[1]));
        }
    }

    return [...rowIndexes].sort((left, right) => left - right);
}

function getParcelRowFieldValue(
    fields: Record<string, string> | undefined,
    rowIndex: number,
    fieldName: ParcelRowFieldName,
) {
    return (
        fields?.[getParcelRowFieldName(rowIndex, fieldName)] ?? parcelRowFieldDefaults[fieldName]
    );
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
    className,
}: Readonly<{
    title: string;
    description: string;
    selected: boolean;
    onClick: () => void;
    className?: string;
}>) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "rounded-xl border bg-background p-4 text-left transition-colors hover:border-foreground/30",
                {
                    "border-foreground/80 bg-foreground/5": selected,
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

                {selected ? (
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-foreground" />
                ) : null}
            </div>
        </button>
    );
}

export function CreateParcelForm({ options, readOnly }: Readonly<CreateParcelFormProps>) {
    const [state, action, isPending] = useActionState(createParcelAction, initialState);
    const merchants = options.merchants;
    const riders = options.riders;
    const townships = options.townships;
    const merchantFieldReadOnly = readOnly?.merchantField ?? false;
    const defaultMerchantId = merchants[0]?.id ?? "";
    const defaultMerchantSelection = merchantFieldReadOnly ? defaultMerchantId : "";
    const nextRowIdRef = useRef(0);
    const createParcelRow = (parcelType: ParcelType = "cod") => {
        nextRowIdRef.current += 1;

        return {
            id: `parcel-row-${nextRowIdRef.current}`,
            parcelType,
        } satisfies ParcelRowDraft;
    };
    const buildParcelRowsFromFields = (fields: Record<string, string> | undefined) => {
        const rowIndexes = getParcelRowIndexes(fields);

        if (rowIndexes.length === 0) {
            return [createParcelRow()];
        }

        return rowIndexes.map((rowIndex) =>
            createParcelRow(
                getSafeParcelTypeValue(fields?.[getParcelRowFieldName(rowIndex, "parcelType")]),
            ),
        );
    };
    const [selectedMerchantId, setSelectedMerchantId] = useState(
        state.fields?.merchantId ?? defaultMerchantSelection,
    );
    const [selectedRiderId, setSelectedRiderId] = useState(state.fields?.riderId ?? "");
    const [selectedDeliveryFeePayer, setSelectedDeliveryFeePayer] = useState<DeliveryFeePayer>(
        getSafeDeliveryFeePayerValue(state.fields?.deliveryFeePayer),
    );
    const [selectedDeliveryFeePaymentPlan, setSelectedDeliveryFeePaymentPlan] =
        useState<DeliveryFeePaymentPlan>(
            (state.fields?.deliveryFeePaymentPlan as DeliveryFeePaymentPlan | undefined) ??
                DEFAULT_CREATE_PARCEL_STATE.deliveryFeePaymentPlan,
        );
    const [paymentSlipFileCount, setPaymentSlipFileCount] = useState(0);
    const [parcelRows, setParcelRows] = useState<ParcelRowDraft[]>(() =>
        buildParcelRowsFromFields(state.fields),
    );

    useEffect(() => {
        if (!state.fields) {
            return;
        }

        const nextMerchantId = state.fields.merchantId ?? defaultMerchantSelection;
        const nextRiderId = state.fields.riderId ?? "";
        const nextDeliveryFeePayer = getSafeDeliveryFeePayerValue(state.fields.deliveryFeePayer);
        const nextParcelRows = buildParcelRowsFromFields(state.fields);
        const allNextRowsCod = nextParcelRows.every((row, index) => {
            const rowType = getSafeParcelTypeValue(
                state.fields?.[getParcelRowFieldName(index, "parcelType")],
            );

            return rowType === "cod";
        });
        const nextPaymentPlanOptions = getDeliveryFeePaymentPlanOptions({
            parcelType: allNextRowsCod ? "cod" : "non_cod",
            deliveryFeePayer: nextDeliveryFeePayer,
        });

        setSelectedMerchantId(nextMerchantId);
        setSelectedRiderId(nextRiderId);
        setSelectedDeliveryFeePayer(nextDeliveryFeePayer);
        setSelectedDeliveryFeePaymentPlan(
            getSafePaymentPlanValue(state.fields.deliveryFeePaymentPlan, nextPaymentPlanOptions),
        );
        setParcelRows(nextParcelRows);
    }, [defaultMerchantSelection, state.fields]);

    const selectedMerchant = merchants.find((merchant) => merchant.id === selectedMerchantId);
    const merchantOptions = merchants.map((merchant) => ({
        value: merchant.id,
        label: merchant.label,
    }));
    const riderOptions = riders.map((rider) => ({
        value: rider.id,
        label: rider.label,
    }));
    const allParcelRowsCod = parcelRows.every((row) => row.parcelType === "cod");
    const deliveryFeePaymentPlanOptions = getDeliveryFeePaymentPlanOptions({
        parcelType: allParcelRowsCod ? "cod" : "non_cod",
        deliveryFeePayer: selectedDeliveryFeePayer,
    });
    const deliveryFeePaymentPlanValue = getSafePaymentPlanValue(
        selectedDeliveryFeePaymentPlan,
        deliveryFeePaymentPlanOptions,
    );
    const showPaymentSlipField = deliveryFeePaymentPlanValue === "merchant_prepaid_bank_transfer";
    const rowLimitReached = parcelRows.length >= CREATE_PARCEL_MAX_ROWS;
    const getFieldError = (fieldName: string) => state.fieldErrors?.[fieldName]?.[0];
    const getParcelRowFieldError = (rowIndex: number, fieldName: ParcelRowFieldName) =>
        getFieldError(getParcelRowFieldName(rowIndex, fieldName));

    useEffect(() => {
        setSelectedDeliveryFeePaymentPlan((current) =>
            getSafePaymentPlanValue(current, deliveryFeePaymentPlanOptions),
        );
    }, [allParcelRowsCod, selectedDeliveryFeePayer]);

    useEffect(() => {
        if (!showPaymentSlipField) {
            setPaymentSlipFileCount(0);
        }
    }, [showPaymentSlipField]);

    const updateParcelType = (rowId: string, nextParcelType: ParcelType) => {
        setParcelRows((currentRows) =>
            currentRows.map((row) =>
                row.id === rowId ? { ...row, parcelType: nextParcelType } : row,
            ),
        );
    };

    const addParcelRow = () => {
        setParcelRows((currentRows) => {
            if (currentRows.length >= CREATE_PARCEL_MAX_ROWS) {
                return currentRows;
            }

            return [...currentRows, createParcelRow()];
        });
    };

    const removeParcelRow = (rowId: string) => {
        setParcelRows((currentRows) => {
            if (currentRows.length === 1) {
                return currentRows;
            }

            return currentRows.filter((row) => row.id !== rowId);
        });
    };

    return (
        <form action={action} className="space-y-5">
            <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-sm font-semibold">Batch Create for One Recipient</p>
                <p className="mt-1 text-xs text-muted-foreground">
                    Fill the shared recipient and billing details once, then add one parcel row per
                    package. Parcel codes are generated automatically during create.
                </p>
            </div>

            <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
                <SectionHeader
                    step={1}
                    title="People"
                    description="Assign the merchant and rider, then capture the shared recipient delivery details."
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
                        className={textareaClassName}
                    />
                    <FormFieldError message={getFieldError("recipientAddress")} />
                </div>
            </section>

            <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
                <SectionHeader
                    step={2}
                    title="Billing & Status"
                    description="Apply one delivery fee payer and payment plan across this batch, then upload shared transfer proof if needed."
                />

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2 md:col-span-2">
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

                    <div className="grid gap-2 md:col-span-2">
                        <Label>Delivery Fee Payment Plan *</Label>
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
                        <FormFieldError message={getFieldError("deliveryFeePaymentPlan")} />
                    </div>
                </div>

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
                                        : "Upload Shared Payment Slip Images"}
                                </EmptyTitle>
                                <EmptyDescription>
                                    Add JPG, PNG, or WEBP images once and they will be attached to
                                    every parcel payment record in this batch.
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
                                    {paymentSlipFileCount > 0 ? "Change Images" : "Choose Images"}
                                </label>
                            </EmptyContent>
                        </Empty>
                        <FormFieldError message={getFieldError("paymentSlipImages")} />
                    </div>
                ) : null}

                <div className="grid gap-2">
                    <Label htmlFor="paymentNote">Payment Note (Optional)</Label>
                    <textarea
                        id="paymentNote"
                        name="paymentNote"
                        rows={4}
                        defaultValue={state.fields?.paymentNote}
                        className={textareaClassName}
                    />
                    <FormFieldError message={getFieldError("paymentNote")} />
                </div>
            </section>

            <section className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <SectionHeader
                        step={3}
                        title="Parcel Details"
                        description="Add one row per parcel for this recipient. Shared billing and recipient fields stay above."
                    />
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                            {parcelRows.length} / {CREATE_PARCEL_MAX_ROWS} rows
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addParcelRow}
                            disabled={rowLimitReached}
                        >
                            <PlusIcon className="size-4" />
                            Add Parcel
                        </Button>
                    </div>
                </div>

                <FormFieldError message={getFieldError("parcelRows")} />

                <div className="space-y-4">
                    {parcelRows.map((row, rowIndex) => {
                        const parcelType = row.parcelType;
                        const rowCodStatus =
                            parcelType === "non_cod"
                                ? "Not Applicable"
                                : formatParcelStatusLabel(DEFAULT_CREATE_PARCEL_STATE.codStatus);
                        const rowCollectionStatus =
                            parcelType === "non_cod"
                                ? "Void"
                                : formatParcelStatusLabel(
                                      DEFAULT_CREATE_PARCEL_STATE.collectionStatus,
                                  );

                        return (
                            <section
                                key={row.id}
                                className="space-y-4 rounded-xl border bg-background p-4"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold">
                                            Parcel {rowIndex + 1}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            Parcel status starts as Pending. COD status:{" "}
                                            {rowCodStatus}. Collection status: {rowCollectionStatus}
                                            .
                                        </p>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeParcelRow(row.id)}
                                        disabled={parcelRows.length === 1}
                                    >
                                        <Trash2Icon className="size-4" />
                                        Remove
                                    </Button>
                                </div>

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
                                                selected={parcelType === type}
                                                onClick={() => updateParcelType(row.id, type)}
                                            />
                                        ))}
                                    </div>
                                    <input
                                        type="hidden"
                                        name={getParcelRowFieldName(rowIndex, "parcelType")}
                                        value={parcelType}
                                    />
                                    <FormFieldError
                                        message={getParcelRowFieldError(rowIndex, "parcelType")}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor={`parcelDescription-${row.id}`}>
                                        Parcel Description *
                                    </Label>
                                    <textarea
                                        id={`parcelDescription-${row.id}`}
                                        name={getParcelRowFieldName(rowIndex, "parcelDescription")}
                                        rows={3}
                                        defaultValue={getParcelRowFieldValue(
                                            state.fields,
                                            rowIndex,
                                            "parcelDescription",
                                        )}
                                        required
                                        className={textareaClassName}
                                    />
                                    <FormFieldError
                                        message={getParcelRowFieldError(
                                            rowIndex,
                                            "parcelDescription",
                                        )}
                                    />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                                    <div className="grid gap-2">
                                        <Label htmlFor={`packageCount-${row.id}`}>
                                            Package Count *
                                        </Label>
                                        <Input
                                            id={`packageCount-${row.id}`}
                                            name={getParcelRowFieldName(rowIndex, "packageCount")}
                                            type="number"
                                            min="1"
                                            step="1"
                                            defaultValue={getParcelRowFieldValue(
                                                state.fields,
                                                rowIndex,
                                                "packageCount",
                                            )}
                                            required
                                        />
                                        <FormFieldError
                                            message={getParcelRowFieldError(
                                                rowIndex,
                                                "packageCount",
                                            )}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor={`estimatedWeightKg-${row.id}`}>
                                            Weight (kg)
                                        </Label>
                                        <Input
                                            id={`estimatedWeightKg-${row.id}`}
                                            name={getParcelRowFieldName(
                                                rowIndex,
                                                "estimatedWeightKg",
                                            )}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            defaultValue={getParcelRowFieldValue(
                                                state.fields,
                                                rowIndex,
                                                "estimatedWeightKg",
                                            )}
                                        />
                                        <FormFieldError
                                            message={getParcelRowFieldError(
                                                rowIndex,
                                                "estimatedWeightKg",
                                            )}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor={`packageWidthCm-${row.id}`}>
                                            Width (cm)
                                        </Label>
                                        <Input
                                            id={`packageWidthCm-${row.id}`}
                                            name={getParcelRowFieldName(rowIndex, "packageWidthCm")}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            defaultValue={getParcelRowFieldValue(
                                                state.fields,
                                                rowIndex,
                                                "packageWidthCm",
                                            )}
                                        />
                                        <FormFieldError
                                            message={getParcelRowFieldError(
                                                rowIndex,
                                                "packageWidthCm",
                                            )}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor={`packageHeightCm-${row.id}`}>
                                            Height (cm)
                                        </Label>
                                        <Input
                                            id={`packageHeightCm-${row.id}`}
                                            name={getParcelRowFieldName(
                                                rowIndex,
                                                "packageHeightCm",
                                            )}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            defaultValue={getParcelRowFieldValue(
                                                state.fields,
                                                rowIndex,
                                                "packageHeightCm",
                                            )}
                                        />
                                        <FormFieldError
                                            message={getParcelRowFieldError(
                                                rowIndex,
                                                "packageHeightCm",
                                            )}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor={`packageLengthCm-${row.id}`}>
                                            Length (cm)
                                        </Label>
                                        <Input
                                            id={`packageLengthCm-${row.id}`}
                                            name={getParcelRowFieldName(
                                                rowIndex,
                                                "packageLengthCm",
                                            )}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            defaultValue={getParcelRowFieldValue(
                                                state.fields,
                                                rowIndex,
                                                "packageLengthCm",
                                            )}
                                        />
                                        <FormFieldError
                                            message={getParcelRowFieldError(
                                                rowIndex,
                                                "packageLengthCm",
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor={`deliveryFee-${row.id}`}>
                                            Delivery Fee *
                                        </Label>
                                        <InputGroup>
                                            <InputGroupInput
                                                id={`deliveryFee-${row.id}`}
                                                name={getParcelRowFieldName(
                                                    rowIndex,
                                                    "deliveryFee",
                                                )}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                defaultValue={getParcelRowFieldValue(
                                                    state.fields,
                                                    rowIndex,
                                                    "deliveryFee",
                                                )}
                                                required
                                            />
                                            <InputGroupAddon align="inline-start">
                                                <InputGroupText>Ks</InputGroupText>
                                            </InputGroupAddon>
                                        </InputGroup>
                                        <FormFieldError
                                            message={getParcelRowFieldError(
                                                rowIndex,
                                                "deliveryFee",
                                            )}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor={`codAmount-${row.id}`}>COD Amount *</Label>
                                        <InputGroup>
                                            {parcelType === "non_cod" ? (
                                                <>
                                                    <input
                                                        type="hidden"
                                                        name={getParcelRowFieldName(
                                                            rowIndex,
                                                            "codAmount",
                                                        )}
                                                        value="0"
                                                    />
                                                    <InputGroupInput
                                                        id={`codAmount-${row.id}`}
                                                        value="0"
                                                        readOnly
                                                        disabled
                                                        aria-readonly="true"
                                                    />
                                                </>
                                            ) : (
                                                <InputGroupInput
                                                    id={`codAmount-${row.id}`}
                                                    name={getParcelRowFieldName(
                                                        rowIndex,
                                                        "codAmount",
                                                    )}
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    defaultValue={getParcelRowFieldValue(
                                                        state.fields,
                                                        rowIndex,
                                                        "codAmount",
                                                    )}
                                                    required
                                                />
                                            )}
                                            <InputGroupAddon align="inline-start">
                                                <InputGroupText>Ks</InputGroupText>
                                            </InputGroupAddon>
                                        </InputGroup>
                                        {parcelType === "non_cod" ? (
                                            <p className="text-xs text-muted-foreground">
                                                Non-COD parcels do not collect COD. COD amount will
                                                be submitted as 0.
                                            </p>
                                        ) : null}
                                        <FormFieldError
                                            message={getParcelRowFieldError(rowIndex, "codAmount")}
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor={`specialHandlingNote-${row.id}`}>
                                        Special Handling Note (Optional)
                                    </Label>
                                    <textarea
                                        id={`specialHandlingNote-${row.id}`}
                                        name={getParcelRowFieldName(
                                            rowIndex,
                                            "specialHandlingNote",
                                        )}
                                        rows={3}
                                        defaultValue={getParcelRowFieldValue(
                                            state.fields,
                                            rowIndex,
                                            "specialHandlingNote",
                                        )}
                                        className={textareaClassName}
                                    />
                                    <FormFieldError
                                        message={getParcelRowFieldError(
                                            rowIndex,
                                            "specialHandlingNote",
                                        )}
                                    />
                                </div>
                            </section>
                        );
                    })}
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
                {isPending
                    ? `Creating ${parcelRows.length} Parcel${parcelRows.length === 1 ? "" : "s"}...`
                    : `Create ${parcelRows.length} Parcel${parcelRows.length === 1 ? "" : "s"}`}
            </Button>
        </form>
    );
}
