"use client";

import { CheckCircle2Icon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { quoteDeliveryPricingAction } from "@/features/delivery-pricing/server/actions";
import {
    RecipientAddressBookFields,
    type RecipientAddressBookFieldsValue,
} from "@/features/merchant-contacts/components/recipient-address-book-fields";
import {
    PickupAddressBookFields,
    type PickupAddressBookFieldsValue,
} from "@/features/merchant-pickup-locations/components/pickup-address-book-fields";
import { PaymentSlipUpload } from "@/features/parcels/components/payment-slip-upload";
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
    initialMerchantId?: string | null;
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
    packageCount: string;
    isLargeItem: boolean;
};
type ParcelRowQuoteFields = {
    estimatedWeightKg: string;
    packageWidthCm: string;
    packageHeightCm: string;
    packageLengthCm: string;
    deliveryFee: string;
};
type ParcelRowQuoteState = {
    status: "idle" | "loading" | "ready" | "missing" | "error";
    message: string;
    rateScope: "global" | "merchant_specific" | null;
    chargeableWeightKg: string | null;
    volumetricWeightKg: string | null;
    lastRequestKey: string | null;
};

const textareaClassName =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const parcelRowFieldDefaults = {
    parcelDescription: "",
    packageCount: "1",
    specialHandlingNote: "",
    estimatedWeightKg: "",
    isLargeItem: "false",
    packageWidthCm: "",
    packageHeightCm: "",
    packageLengthCm: "",
    parcelType: "cod",
    codAmount: "",
    deliveryFee: "",
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

function getSafeIsLargeItemValue(value: string | undefined) {
    return value === "true";
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

function getParcelRowQuoteFields(fields: Record<string, string> | undefined, rowIndex: number) {
    return {
        estimatedWeightKg: getParcelRowFieldValue(fields, rowIndex, "estimatedWeightKg"),
        packageWidthCm: getParcelRowFieldValue(fields, rowIndex, "packageWidthCm"),
        packageHeightCm: getParcelRowFieldValue(fields, rowIndex, "packageHeightCm"),
        packageLengthCm: getParcelRowFieldValue(fields, rowIndex, "packageLengthCm"),
        deliveryFee: getParcelRowFieldValue(fields, rowIndex, "deliveryFee"),
    } satisfies ParcelRowQuoteFields;
}

function getRequestedParcelCount(value: string) {
    const count = Number(value);

    if (!Number.isSafeInteger(count) || count < 1) {
        return 0;
    }

    return count;
}

function getSafePackageCountNumber(value: string | undefined) {
    const count = getRequestedParcelCount(value ?? "");

    return count === 0 ? 1 : count;
}

function getSafePackageCountValue(value: string | undefined) {
    return getSafePackageCountNumber(value).toString();
}

function getParcelQuoteRequestKey(input: {
    merchantId: string;
    recipientTownshipId: string;
    parcelType: ParcelType;
    isLargeItem: boolean;
    estimatedWeightKg: string;
    packageWidthCm: string;
    packageHeightCm: string;
    packageLengthCm: string;
}) {
    return [
        input.merchantId,
        input.recipientTownshipId,
        input.parcelType,
        input.isLargeItem ? "large" : "standard",
        input.estimatedWeightKg.trim(),
        input.packageWidthCm.trim(),
        input.packageHeightCm.trim(),
        input.packageLengthCm.trim(),
    ].join("|");
}

function getEmptyParcelQuoteState(
    requestKey: string | null = null,
    message = "Enter weight and township to calculate pricing.",
): ParcelRowQuoteState {
    return {
        status: "idle",
        message,
        rateScope: null,
        chargeableWeightKg: null,
        volumetricWeightKg: null,
        lastRequestKey: requestKey,
    };
}

function getRecipientAddressBookDefaults(
    fields: Record<string, string> | undefined,
): RecipientAddressBookFieldsValue {
    return {
        selectedMerchantContactId: fields?.selectedMerchantContactId ?? "",
        contactLabel: fields?.contactLabel ?? "",
        saveRecipientContact:
            fields?.saveRecipientContact === "true" || fields?.saveRecipientContact === "on",
        recipientName: fields?.recipientName ?? "",
        recipientPhone: fields?.recipientPhone ?? "",
        recipientTownshipId: fields?.recipientTownshipId ?? "",
        recipientAddress: fields?.recipientAddress ?? "",
    };
}

function getPickupLocationDefaults(
    fields: Record<string, string> | undefined,
): PickupAddressBookFieldsValue {
    return {
        pickupLocationId: fields?.pickupLocationId ?? "",
        pickupLocationLabel: fields?.pickupLocationLabel ?? "",
        pickupTownshipId: fields?.pickupTownshipId ?? "",
        pickupAddress: fields?.pickupAddress ?? "",
        pickupContactName: fields?.pickupContactName ?? "",
        pickupContactPhone: fields?.pickupContactPhone ?? "",
        savePickupLocation:
            fields?.savePickupLocation === "true" || fields?.savePickupLocation === "on",
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

export function CreateParcelForm({
    options,
    initialMerchantId = null,
    readOnly,
}: Readonly<CreateParcelFormProps>) {
    const [state, action, isPending] = useActionState(createParcelAction, initialState);
    const merchants = options.merchants;
    const riders = options.riders;
    const townships = options.townships;
    const merchantFieldReadOnly = readOnly?.merchantField ?? false;
    const defaultMerchantId = merchants[0]?.id ?? "";
    const initialMerchantSelection =
        initialMerchantId && merchants.some((merchant) => merchant.id === initialMerchantId)
            ? initialMerchantId
            : "";
    const defaultMerchantSelection = merchantFieldReadOnly
        ? defaultMerchantId
        : initialMerchantSelection;
    const nextRowIdRef = useRef(0);
    const createParcelRow = (
        parcelType: ParcelType = "cod",
        packageCount = "1",
        isLargeItem = false,
    ) => {
        nextRowIdRef.current += 1;

        return {
            id: `parcel-row-${nextRowIdRef.current}`,
            parcelType,
            packageCount: getSafePackageCountValue(packageCount),
            isLargeItem,
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
                getParcelRowFieldValue(fields, rowIndex, "packageCount"),
                getSafeIsLargeItemValue(fields?.[getParcelRowFieldName(rowIndex, "isLargeItem")]),
            ),
        );
    };
    const buildQuoteFieldsByRowId = (
        rows: ParcelRowDraft[],
        fields: Record<string, string> | undefined,
    ) =>
        Object.fromEntries(
            rows.map((row, rowIndex) => [row.id, getParcelRowQuoteFields(fields, rowIndex)]),
        ) satisfies Record<string, ParcelRowQuoteFields>;
    const buildQuoteStatesByRowId = (rows: ParcelRowDraft[]) =>
        Object.fromEntries(
            rows.map((row) => [row.id, getEmptyParcelQuoteState()]),
        ) satisfies Record<string, ParcelRowQuoteState>;
    const initialParcelRowsRef = useRef<ParcelRowDraft[] | null>(null);

    initialParcelRowsRef.current ??= buildParcelRowsFromFields(state.fields);

    const initialParcelRows = initialParcelRowsRef.current;
    const [selectedMerchantId, setSelectedMerchantId] = useState(
        state.fields?.merchantId ?? defaultMerchantSelection,
    );
    const [selectedRiderId, setSelectedRiderId] = useState(state.fields?.riderId ?? "");
    const [pickupLocationValues, setPickupLocationValues] = useState<PickupAddressBookFieldsValue>(
        () => getPickupLocationDefaults(state.fields),
    );
    const [recipientAddressBookValues, setRecipientAddressBookValues] =
        useState<RecipientAddressBookFieldsValue>(() =>
            getRecipientAddressBookDefaults(state.fields),
        );
    const [selectedDeliveryFeePayer, setSelectedDeliveryFeePayer] = useState<DeliveryFeePayer>(
        getSafeDeliveryFeePayerValue(state.fields?.deliveryFeePayer),
    );
    const [selectedDeliveryFeePaymentPlan, setSelectedDeliveryFeePaymentPlan] =
        useState<DeliveryFeePaymentPlan>(
            (state.fields?.deliveryFeePaymentPlan as DeliveryFeePaymentPlan | undefined) ??
                DEFAULT_CREATE_PARCEL_STATE.deliveryFeePaymentPlan,
        );
    const [parcelRows, setParcelRows] = useState<ParcelRowDraft[]>(initialParcelRows);
    const [rowQuoteFields, setRowQuoteFields] = useState<Record<string, ParcelRowQuoteFields>>(() =>
        buildQuoteFieldsByRowId(initialParcelRows, state.fields),
    );
    const [rowQuoteStates, setRowQuoteStates] = useState<Record<string, ParcelRowQuoteState>>(() =>
        buildQuoteStatesByRowId(initialParcelRows),
    );
    const [rowDeliveryFeeOverrides, setRowDeliveryFeeOverrides] = useState<Record<string, boolean>>(
        () =>
            Object.fromEntries(
                initialParcelRows.map((row, rowIndex) => [
                    row.id,
                    Boolean(getParcelRowFieldValue(state.fields, rowIndex, "deliveryFee")),
                ]),
            ),
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
        setPickupLocationValues(getPickupLocationDefaults(state.fields));
        setRecipientAddressBookValues(getRecipientAddressBookDefaults(state.fields));
        setSelectedDeliveryFeePayer(nextDeliveryFeePayer);
        setSelectedDeliveryFeePaymentPlan(
            getSafePaymentPlanValue(state.fields.deliveryFeePaymentPlan, nextPaymentPlanOptions),
        );
        setParcelRows(nextParcelRows);
        setRowQuoteFields(buildQuoteFieldsByRowId(nextParcelRows, state.fields));
        setRowQuoteStates(buildQuoteStatesByRowId(nextParcelRows));
        setRowDeliveryFeeOverrides(
            Object.fromEntries(
                nextParcelRows.map((row, rowIndex) => [
                    row.id,
                    Boolean(getParcelRowFieldValue(state.fields, rowIndex, "deliveryFee")),
                ]),
            ),
        );
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
    const totalRequestedParcels = parcelRows.reduce(
        (total, row) => total + getRequestedParcelCount(row.packageCount),
        0,
    );
    const rowLimitReached = totalRequestedParcels >= CREATE_PARCEL_MAX_ROWS;
    const requestedParcelLimitExceeded = totalRequestedParcels > CREATE_PARCEL_MAX_ROWS;
    const getFieldError = (fieldName: string) => state.fieldErrors?.[fieldName]?.[0];
    const getParcelRowFieldError = (rowIndex: number, fieldName: ParcelRowFieldName) =>
        getFieldError(getParcelRowFieldName(rowIndex, fieldName));

    useEffect(() => {
        setSelectedDeliveryFeePaymentPlan((current) =>
            getSafePaymentPlanValue(current, deliveryFeePaymentPlanOptions),
        );
    }, [allParcelRowsCod, selectedDeliveryFeePayer]);

    useEffect(() => {
        const timeoutIds: ReturnType<typeof setTimeout>[] = [];

        for (const [rowIndex, row] of parcelRows.entries()) {
            const rowFields =
                rowQuoteFields[row.id] ?? getParcelRowQuoteFields(state.fields, rowIndex);
            const requestKey = getParcelQuoteRequestKey({
                merchantId: selectedMerchantId,
                recipientTownshipId: recipientAddressBookValues.recipientTownshipId,
                parcelType: row.parcelType,
                isLargeItem: row.isLargeItem,
                estimatedWeightKg: rowFields.estimatedWeightKg,
                packageWidthCm: rowFields.packageWidthCm,
                packageHeightCm: rowFields.packageHeightCm,
                packageLengthCm: rowFields.packageLengthCm,
            });
            const needsDimensions =
                row.isLargeItem &&
                (!rowFields.packageWidthCm.trim() ||
                    !rowFields.packageHeightCm.trim() ||
                    !rowFields.packageLengthCm.trim());
            const currentQuoteState = rowQuoteStates[row.id];

            if (
                !selectedMerchantId ||
                !recipientAddressBookValues.recipientTownshipId ||
                !rowFields.estimatedWeightKg.trim()
            ) {
                if (
                    currentQuoteState?.status === "idle" &&
                    currentQuoteState.lastRequestKey === requestKey &&
                    currentQuoteState.message === "Enter weight and township to calculate pricing."
                ) {
                    continue;
                }

                setRowQuoteStates((current) => ({
                    ...current,
                    [row.id]: getEmptyParcelQuoteState(requestKey),
                }));
                continue;
            }

            if (needsDimensions) {
                if (
                    currentQuoteState?.status === "idle" &&
                    currentQuoteState.lastRequestKey === requestKey &&
                    currentQuoteState.message ===
                        "Enter all large-item dimensions to calculate pricing."
                ) {
                    continue;
                }

                setRowQuoteStates((current) => ({
                    ...current,
                    [row.id]: getEmptyParcelQuoteState(
                        requestKey,
                        "Enter all large-item dimensions to calculate pricing.",
                    ),
                }));
                continue;
            }

            if (currentQuoteState?.lastRequestKey === requestKey) {
                continue;
            }

            timeoutIds.push(
                setTimeout(() => {
                    void requestDeliveryPricingQuote(row.id, requestKey, false);
                }, 250),
            );
        }

        return () => {
            for (const timeoutId of timeoutIds) {
                clearTimeout(timeoutId);
            }
        };
    }, [
        parcelRows,
        rowQuoteFields,
        rowQuoteStates,
        selectedMerchantId,
        recipientAddressBookValues.recipientTownshipId,
        state.fields,
    ]);

    const updateRowQuoteFields = (
        rowId: string,
        nextFields: Partial<ParcelRowQuoteFields>,
        options?: { markDeliveryFeeOverride?: boolean },
    ) => {
        setRowQuoteFields((current) => ({
            ...current,
            [rowId]: {
                ...(current[rowId] ?? {
                    estimatedWeightKg: "",
                    packageWidthCm: "",
                    packageHeightCm: "",
                    packageLengthCm: "",
                    deliveryFee: "",
                }),
                ...nextFields,
            },
        }));

        if (options?.markDeliveryFeeOverride) {
            setRowDeliveryFeeOverrides((current) => ({
                ...current,
                [rowId]: true,
            }));
        }
    };

    const requestDeliveryPricingQuote = async (
        rowId: string,
        requestKey: string,
        forceApplyFee: boolean,
    ) => {
        const row = parcelRows.find((item) => item.id === rowId);
        const rowFields = rowQuoteFields[rowId];

        if (!row || !rowFields) {
            return;
        }

        setRowQuoteStates((current) => ({
            ...current,
            [rowId]: {
                ...(current[rowId] ?? getEmptyParcelQuoteState()),
                status: "loading",
                message: "Calculating pricing...",
                lastRequestKey: requestKey,
            },
        }));

        const result = await quoteDeliveryPricingAction({
            merchantId: selectedMerchantId,
            recipientTownshipId: recipientAddressBookValues.recipientTownshipId,
            estimatedWeightKg: rowFields.estimatedWeightKg,
            isLargeItem: row.isLargeItem,
            packageWidthCm: rowFields.packageWidthCm,
            packageHeightCm: rowFields.packageHeightCm,
            packageLengthCm: rowFields.packageLengthCm,
        });

        if (!result.ok) {
            setRowQuoteStates((current) => {
                const existing = current[rowId];

                if (existing?.lastRequestKey !== requestKey) {
                    return current;
                }

                return {
                    ...current,
                    [rowId]: {
                        status: "missing",
                        message: result.message,
                        rateScope: null,
                        chargeableWeightKg: null,
                        volumetricWeightKg: null,
                        lastRequestKey: requestKey,
                    },
                };
            });

            return;
        }

        setRowQuoteStates((current) => {
            const existing = current[rowId];

            if (existing?.lastRequestKey !== requestKey) {
                return current;
            }

            return {
                ...current,
                [rowId]: {
                    status: "ready",
                    message:
                        result.rateScope === "merchant_specific"
                            ? "Applied merchant contract pricing."
                            : "Applied global township pricing.",
                    rateScope: result.rateScope,
                    chargeableWeightKg: result.chargeableWeightKg,
                    volumetricWeightKg: result.volumetricWeightKg,
                    lastRequestKey: requestKey,
                },
            };
        });

        if (forceApplyFee || !rowDeliveryFeeOverrides[rowId] || !rowFields.deliveryFee.trim()) {
            updateRowQuoteFields(
                rowId,
                {
                    deliveryFee: result.deliveryFee,
                },
                { markDeliveryFeeOverride: false },
            );
            setRowDeliveryFeeOverrides((current) => ({
                ...current,
                [rowId]: false,
            }));
        }
    };

    const updateParcelType = (rowId: string, nextParcelType: ParcelType) => {
        setParcelRows((currentRows) =>
            currentRows.map((row) =>
                row.id === rowId ? { ...row, parcelType: nextParcelType } : row,
            ),
        );
    };

    const updateLargeItem = (rowId: string, nextIsLargeItem: boolean) => {
        setParcelRows((currentRows) =>
            currentRows.map((row) =>
                row.id === rowId ? { ...row, isLargeItem: nextIsLargeItem } : row,
            ),
        );
    };

    const updatePackageCount = (rowId: string, delta: -1 | 1) => {
        setParcelRows((currentRows) => {
            const currentTotalRequestedParcels = currentRows.reduce(
                (total, row) => total + getRequestedParcelCount(row.packageCount),
                0,
            );

            return currentRows.map((row) => {
                if (row.id !== rowId) {
                    return row;
                }

                const currentCount = getSafePackageCountNumber(row.packageCount);
                const nextCount = currentCount + delta;

                if (nextCount < 1) {
                    return row;
                }

                if (delta > 0 && currentTotalRequestedParcels >= CREATE_PARCEL_MAX_ROWS) {
                    return row;
                }

                return {
                    ...row,
                    packageCount: nextCount.toString(),
                };
            });
        });
    };

    const addParcelRow = () => {
        setParcelRows((currentRows) => {
            const currentTotalRequestedParcels = currentRows.reduce(
                (total, row) => total + getRequestedParcelCount(row.packageCount),
                0,
            );

            if (currentTotalRequestedParcels >= CREATE_PARCEL_MAX_ROWS) {
                return currentRows;
            }

            const nextRow = createParcelRow();

            setRowQuoteFields((current) => ({
                ...current,
                [nextRow.id]: {
                    estimatedWeightKg: "",
                    packageWidthCm: "",
                    packageHeightCm: "",
                    packageLengthCm: "",
                    deliveryFee: "",
                },
            }));
            setRowQuoteStates((current) => ({
                ...current,
                [nextRow.id]: getEmptyParcelQuoteState(),
            }));
            setRowDeliveryFeeOverrides((current) => ({
                ...current,
                [nextRow.id]: false,
            }));

            return [...currentRows, nextRow];
        });
    };

    const removeParcelRow = (rowId: string) => {
        setParcelRows((currentRows) => {
            if (currentRows.length === 1) {
                return currentRows;
            }

            setRowQuoteFields((current) => {
                const next = { ...current };
                delete next[rowId];
                return next;
            });
            setRowQuoteStates((current) => {
                const next = { ...current };
                delete next[rowId];
                return next;
            });
            setRowDeliveryFeeOverrides((current) => {
                const next = { ...current };
                delete next[rowId];
                return next;
            });

            return currentRows.filter((row) => row.id !== rowId);
        });
    };

    return (
        <TooltipProvider>
            <form action={action} className="space-y-5">
                <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="text-sm font-semibold">Batch Create for One Recipient</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Fill the shared recipient and billing details once, then add one row per
                        identical parcel setup. Package count creates separate parcel records;
                        weight, dimensions, and fees are per parcel. Parcel codes are generated
                        automatically during create.
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
                                        value={
                                            selectedMerchant?.label ?? merchants[0]?.label ?? "-"
                                        }
                                        readOnly
                                        disabled
                                    />
                                    <input
                                        type="hidden"
                                        name="merchantId"
                                        value={selectedMerchantId}
                                    />
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
                                    allowClear
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

                    <PickupAddressBookFields
                        merchantId={selectedMerchantId}
                        townships={townships}
                        values={pickupLocationValues}
                        onChange={(next) =>
                            setPickupLocationValues((current) => ({
                                ...current,
                                ...next,
                            }))
                        }
                        fieldErrors={state.fieldErrors}
                    />

                    <RecipientAddressBookFields
                        merchantId={selectedMerchantId}
                        townships={townships}
                        values={recipientAddressBookValues}
                        onChange={(next) =>
                            setRecipientAddressBookValues((current) => ({
                                ...current,
                                ...next,
                            }))
                        }
                        fieldErrors={state.fieldErrors}
                    />
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
                        <PaymentSlipUpload
                            mode="create"
                            errorMessage={getFieldError("paymentSlipImages")}
                        />
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
                    <div className="flex flex-col gap-x-[50px] sm:flex-row sm:items-start sm:justify-between">
                        <SectionHeader
                            step={3}
                            title="Parcel Details"
                            description="Add one row per identical parcel setup for this recipient. Shared billing and recipient fields stay above."
                        />
                        <div className="flex flex-col-reverse items-center gap-2">
                            <span
                                className={cn("text-xs text-muted-foreground", {
                                    "text-destructive": requestedParcelLimitExceeded,
                                })}
                            >
                                {totalRequestedParcels} / {CREATE_PARCEL_MAX_ROWS} parcels
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
                            const packageCount = getSafePackageCountNumber(row.packageCount);
                            const isLargeItem = row.isLargeItem;
                            const quoteFields =
                                rowQuoteFields[row.id] ??
                                getParcelRowQuoteFields(state.fields, rowIndex);
                            const quoteState = rowQuoteStates[row.id] ?? getEmptyParcelQuoteState();
                            const rowCodStatus =
                                parcelType === "non_cod"
                                    ? "Not Applicable"
                                    : formatParcelStatusLabel(
                                          DEFAULT_CREATE_PARCEL_STATE.codStatus,
                                      );
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
                                                Each created parcel starts as Pending. COD status:{" "}
                                                {rowCodStatus}. Collection status:{" "}
                                                {rowCollectionStatus}.
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
                                            name={getParcelRowFieldName(
                                                rowIndex,
                                                "parcelDescription",
                                            )}
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

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="grid gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <Label htmlFor={`packageCount-${row.id}`}>
                                                    Package Count *
                                                </Label>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            type="button"
                                                            className="inline-flex size-4 items-center justify-center rounded-full border border-border text-[10px] leading-none font-semibold text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                                                            aria-label="Package count info"
                                                        >
                                                            !
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        Creates this many separate parcels with the
                                                        same per-parcel weight, dimensions, delivery
                                                        fee, and COD amount.
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <div className="flex h-8 w-full items-stretch overflow-hidden rounded-lg border border-input bg-background">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="h-full rounded-l-[9px] border-r border-border"
                                                    onClick={() => updatePackageCount(row.id, -1)}
                                                    disabled={packageCount <= 1}
                                                    aria-label={`Decrease package count for parcel setup ${rowIndex + 1}`}
                                                >
                                                    <MinusIcon className="size-4" />
                                                </Button>
                                                <Input
                                                    id={`packageCount-${row.id}`}
                                                    value={packageCount}
                                                    readOnly
                                                    aria-readonly="true"
                                                    className="h-full w-full rounded-none border-0 text-center shadow-none focus-visible:ring-0"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="h-full rounded-r-[9px] border-l border-border"
                                                    onClick={() => updatePackageCount(row.id, 1)}
                                                    disabled={rowLimitReached}
                                                    aria-label={`Increase package count for parcel setup ${rowIndex + 1}`}
                                                >
                                                    <PlusIcon className="size-4" />
                                                </Button>
                                            </div>
                                            <input
                                                type="hidden"
                                                name={getParcelRowFieldName(
                                                    rowIndex,
                                                    "packageCount",
                                                )}
                                                value={packageCount}
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
                                                Weight (kg) *
                                            </Label>
                                            <Input
                                                id={`estimatedWeightKg-${row.id}`}
                                                name={getParcelRowFieldName(
                                                    rowIndex,
                                                    "estimatedWeightKg",
                                                )}
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                defaultValue={quoteFields.estimatedWeightKg}
                                                onChange={(event) =>
                                                    updateRowQuoteFields(row.id, {
                                                        estimatedWeightKg: event.target.value,
                                                    })
                                                }
                                                required
                                            />
                                            <FormFieldError
                                                message={getParcelRowFieldError(
                                                    rowIndex,
                                                    "estimatedWeightKg",
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label>Item Size</Label>
                                            <ChoiceCard
                                                title="Large Item"
                                                description="Show length, width, and height for bulky parcels. Standard items save as 1 x 1 x 1 cm."
                                                selected={isLargeItem}
                                                onClick={() =>
                                                    updateLargeItem(row.id, !isLargeItem)
                                                }
                                                className="h-full"
                                            />
                                            <input
                                                type="hidden"
                                                name={getParcelRowFieldName(
                                                    rowIndex,
                                                    "isLargeItem",
                                                )}
                                                value={isLargeItem ? "true" : "false"}
                                            />
                                            <FormFieldError
                                                message={getParcelRowFieldError(
                                                    rowIndex,
                                                    "isLargeItem",
                                                )}
                                            />
                                        </div>

                                        <div
                                            className={cn(
                                                "grid grid-rows-[min-content] items-start gap-2",
                                                {
                                                    hidden: !isLargeItem,
                                                },
                                            )}
                                            aria-hidden={!isLargeItem}
                                        >
                                            <Label>Dimensions (cm) *</Label>
                                            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
                                                <div className="grid gap-2">
                                                    <Input
                                                        id={`packageLengthCm-${row.id}`}
                                                        name={getParcelRowFieldName(
                                                            rowIndex,
                                                            "packageLengthCm",
                                                        )}
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        placeholder="L"
                                                        aria-label="Length (cm)"
                                                        defaultValue={quoteFields.packageLengthCm}
                                                        onChange={(event) =>
                                                            updateRowQuoteFields(row.id, {
                                                                packageLengthCm: event.target.value,
                                                            })
                                                        }
                                                    />
                                                    <FormFieldError
                                                        message={getParcelRowFieldError(
                                                            rowIndex,
                                                            "packageLengthCm",
                                                        )}
                                                    />
                                                </div>
                                                <span className="flex h-8 items-center justify-center text-sm text-muted-foreground">
                                                    x
                                                </span>
                                                <div className="grid gap-2">
                                                    <Input
                                                        id={`packageWidthCm-${row.id}`}
                                                        name={getParcelRowFieldName(
                                                            rowIndex,
                                                            "packageWidthCm",
                                                        )}
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        placeholder="W"
                                                        aria-label="Width (cm)"
                                                        defaultValue={quoteFields.packageWidthCm}
                                                        onChange={(event) =>
                                                            updateRowQuoteFields(row.id, {
                                                                packageWidthCm: event.target.value,
                                                            })
                                                        }
                                                    />
                                                    <FormFieldError
                                                        message={getParcelRowFieldError(
                                                            rowIndex,
                                                            "packageWidthCm",
                                                        )}
                                                    />
                                                </div>
                                                <span className="flex h-8 items-center justify-center text-sm text-muted-foreground">
                                                    x
                                                </span>
                                                <div className="grid gap-2">
                                                    <Input
                                                        id={`packageHeightCm-${row.id}`}
                                                        name={getParcelRowFieldName(
                                                            rowIndex,
                                                            "packageHeightCm",
                                                        )}
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        placeholder="H"
                                                        aria-label="Height (cm)"
                                                        defaultValue={quoteFields.packageHeightCm}
                                                        onChange={(event) =>
                                                            updateRowQuoteFields(row.id, {
                                                                packageHeightCm: event.target.value,
                                                            })
                                                        }
                                                    />
                                                    <FormFieldError
                                                        message={getParcelRowFieldError(
                                                            rowIndex,
                                                            "packageHeightCm",
                                                        )}
                                                    />
                                                </div>
                                            </div>
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
                                                    min="0.01"
                                                    step="0.01"
                                                    value={quoteFields.deliveryFee}
                                                    onChange={(event) =>
                                                        updateRowQuoteFields(
                                                            row.id,
                                                            {
                                                                deliveryFee: event.target.value,
                                                            },
                                                            { markDeliveryFeeOverride: true },
                                                        )
                                                    }
                                                    required
                                                />
                                                <InputGroupAddon align="inline-start">
                                                    <InputGroupText>Ks</InputGroupText>
                                                </InputGroupAddon>
                                            </InputGroup>
                                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                                <p
                                                    className={cn("text-muted-foreground", {
                                                        "text-foreground":
                                                            quoteState.status === "ready",
                                                        "text-destructive":
                                                            quoteState.status === "missing" ||
                                                            quoteState.status === "error",
                                                    })}
                                                >
                                                    {quoteState.message}
                                                    {quoteState.chargeableWeightKg
                                                        ? ` Chargeable weight: ${quoteState.chargeableWeightKg} kg.`
                                                        : ""}
                                                    {quoteState.volumetricWeightKg
                                                        ? ` Volumetric: ${quoteState.volumetricWeightKg} kg.`
                                                        : ""}
                                                </p>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        void requestDeliveryPricingQuote(
                                                            row.id,
                                                            getParcelQuoteRequestKey({
                                                                merchantId: selectedMerchantId,
                                                                recipientTownshipId:
                                                                    recipientAddressBookValues.recipientTownshipId,
                                                                parcelType: row.parcelType,
                                                                isLargeItem: row.isLargeItem,
                                                                estimatedWeightKg:
                                                                    quoteFields.estimatedWeightKg,
                                                                packageWidthCm:
                                                                    quoteFields.packageWidthCm,
                                                                packageHeightCm:
                                                                    quoteFields.packageHeightCm,
                                                                packageLengthCm:
                                                                    quoteFields.packageLengthCm,
                                                            }),
                                                            true,
                                                        )
                                                    }
                                                    disabled={
                                                        quoteState.status === "loading" ||
                                                        !selectedMerchantId ||
                                                        !recipientAddressBookValues.recipientTownshipId ||
                                                        !quoteFields.estimatedWeightKg.trim()
                                                    }
                                                    className="hidden"
                                                >
                                                    {quoteState.status === "loading"
                                                        ? "Refreshing..."
                                                        : "Refresh Pricing"}
                                                </Button>
                                            </div>
                                            <FormFieldError
                                                message={getParcelRowFieldError(
                                                    rowIndex,
                                                    "deliveryFee",
                                                )}
                                            />
                                        </div>

                                        <div className="grid grid-rows-[min-content] items-start gap-2">
                                            <Label htmlFor={`codAmount-${row.id}`}>
                                                COD Amount *
                                            </Label>
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
                                                        min="0.01"
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
                                                    Non-COD parcels do not collect COD. COD amount
                                                    will be submitted as 0.
                                                </p>
                                            ) : null}
                                            <FormFieldError
                                                message={getParcelRowFieldError(
                                                    rowIndex,
                                                    "codAmount",
                                                )}
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
                        ? `Creating ${totalRequestedParcels} Parcel${totalRequestedParcels === 1 ? "" : "s"}...`
                        : `Create ${totalRequestedParcels} Parcel${totalRequestedParcels === 1 ? "" : "s"}`}
                </Button>
            </form>
        </TooltipProvider>
    );
}
