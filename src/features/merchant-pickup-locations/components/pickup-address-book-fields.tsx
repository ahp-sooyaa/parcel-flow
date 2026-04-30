"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchMerchantPickupLocationsAction } from "@/features/merchant-pickup-locations/server/actions";
import { cn } from "@/lib/utils";

import type { MerchantPickupLocationDto } from "@/features/merchant-pickup-locations/server/dto";

export type PickupAddressBookFieldsValue = {
    pickupLocationId: string;
    pickupLocationLabel: string;
    pickupTownshipId: string;
    pickupAddress: string;
    savePickupLocation: boolean;
};

type PickupAddressBookFieldsProps = {
    merchantId: string;
    townships: {
        id: string;
        label: string;
    }[];
    values: PickupAddressBookFieldsValue;
    onChange: (next: Partial<PickupAddressBookFieldsValue>) => void;
    fieldErrors?: Partial<Record<string, string[]>>;
};

const textareaClassName =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PickupAddressBookFields({
    merchantId,
    townships,
    values,
    onChange,
    fieldErrors,
}: Readonly<PickupAddressBookFieldsProps>) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<MerchantPickupLocationDto[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [detailsExpanded, setDetailsExpanded] = useState(!values.pickupLocationId);
    const previousMerchantIdRef = useRef(merchantId);
    const selectedPickupLocation =
        searchResults.find((location) => location.id === values.pickupLocationId) ?? null;
    const selectedTownship =
        townships.find((township) => township.id === values.pickupTownshipId)?.label ?? null;
    const hasSelectedPickupLocation = Boolean(values.pickupLocationId);
    const shouldShowDetails = detailsExpanded || !hasSelectedPickupLocation;
    const getFieldError = (fieldName: string) => fieldErrors?.[fieldName]?.[0];

    useEffect(() => {
        if (previousMerchantIdRef.current === merchantId) {
            return;
        }

        previousMerchantIdRef.current = merchantId;
        setSearchQuery("");
        setSearchResults([]);
        setDetailsExpanded(true);
        onChange({
            pickupLocationId: "",
            pickupLocationLabel: "",
            pickupTownshipId: "",
            pickupAddress: "",
            savePickupLocation: false,
        });
    }, [merchantId, onChange]);

    useEffect(() => {
        setDetailsExpanded(!values.pickupLocationId);
    }, [values.pickupLocationId]);

    useEffect(() => {
        if (values.pickupLocationId && values.pickupLocationLabel) {
            setSearchQuery(values.pickupLocationLabel);
        }
    }, [values.pickupLocationId, values.pickupLocationLabel]);

    useEffect(() => {
        if (!merchantId) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const timeoutId = setTimeout(() => {
            setIsSearching(true);

            void searchMerchantPickupLocationsAction({
                merchantId,
                query: searchQuery,
            })
                .then((results) => {
                    setSearchResults(results);
                })
                .finally(() => {
                    setIsSearching(false);
                });
        }, 250);

        return () => clearTimeout(timeoutId);
    }, [merchantId, searchQuery]);

    const clearForNewPickup = () => {
        setSearchQuery("");
        setDetailsExpanded(true);
        onChange({
            pickupLocationId: "",
            pickupLocationLabel: "",
            pickupTownshipId: "",
            pickupAddress: "",
            savePickupLocation: false,
        });
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="pickupLocationId">Search Pickup Location</Label>
                    <div className="flex items-center gap-2">
                        {isSearching ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <LoaderCircleIcon className="size-3 animate-spin" />
                                Searching...
                            </span>
                        ) : null}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={clearForNewPickup}
                            disabled={!merchantId}
                        >
                            Add New
                        </Button>
                    </div>
                </div>
                <SearchableCombobox
                    id="pickupLocationId"
                    name="pickupLocationSearch"
                    value={values.pickupLocationId}
                    onValueChange={(nextValue) => {
                        const nextPickupLocation =
                            searchResults.find((location) => location.id === nextValue) ?? null;

                        if (!nextPickupLocation) {
                            onChange({
                                pickupLocationId: "",
                            });
                            return;
                        }

                        onChange({
                            pickupLocationId: nextPickupLocation.id,
                            pickupLocationLabel: nextPickupLocation.label,
                            pickupTownshipId: nextPickupLocation.townshipId,
                            pickupAddress: nextPickupLocation.pickupAddress,
                            savePickupLocation: false,
                        });
                        setSearchQuery(nextPickupLocation.label);
                        setDetailsExpanded(false);
                    }}
                    onInputValueChange={(nextValue) => {
                        setSearchQuery(nextValue);

                        if (values.pickupLocationId) {
                            onChange({
                                pickupLocationId: "",
                            });
                            setDetailsExpanded(true);
                        }
                    }}
                    options={searchResults.map((location) => ({
                        value: location.id,
                        label: location.isDefault ? `${location.label} (Default)` : location.label,
                    }))}
                    placeholder={
                        merchantId ? "Search saved pickup location" : "Select merchant first"
                    }
                    emptyLabel={
                        merchantId
                            ? "No saved pickup locations found."
                            : "Select a merchant to search saved pickup locations."
                    }
                    allowClear
                    disabled={!merchantId}
                    invalid={Boolean(getFieldError("pickupLocationId"))}
                />
                <input type="hidden" name="pickupLocationId" value={values.pickupLocationId} />
                <FormFieldError message={getFieldError("pickupLocationId")} />
            </div>

            {hasSelectedPickupLocation ? (
                <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">
                                    {values.pickupLocationLabel || selectedPickupLocation?.label}
                                </p>
                                {selectedPickupLocation?.isDefault ? (
                                    <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
                                        Default
                                    </span>
                                ) : null}
                            </div>
                            <p>{selectedTownship ?? "No township selected"}</p>
                            <p className="text-muted-foreground">{values.pickupAddress}</p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailsExpanded((current) => !current)}
                        >
                            {detailsExpanded ? "Hide Details" : "Edit Details"}
                        </Button>
                    </div>
                </div>
            ) : null}

            {shouldShowDetails ? (
                <div className="space-y-4 rounded-xl border bg-background p-4">
                    <div className="grid gap-2">
                        <Label htmlFor="pickupLocationLabel">Location Label *</Label>
                        <Input
                            id="pickupLocationLabel"
                            name="pickupLocationLabel"
                            value={values.pickupLocationLabel}
                            onChange={(event) =>
                                onChange({ pickupLocationLabel: event.target.value })
                            }
                            placeholder="Main shop"
                            required
                        />
                        <FormFieldError message={getFieldError("pickupLocationLabel")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="pickupTownshipId">Pickup Township *</Label>
                        <select
                            id="pickupTownshipId"
                            name="pickupTownshipId"
                            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            value={values.pickupTownshipId}
                            onChange={(event) => onChange({ pickupTownshipId: event.target.value })}
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
                        <FormFieldError message={getFieldError("pickupTownshipId")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="pickupAddress">Pickup Address *</Label>
                        <textarea
                            id="pickupAddress"
                            name="pickupAddress"
                            rows={3}
                            value={values.pickupAddress}
                            onChange={(event) => onChange({ pickupAddress: event.target.value })}
                            required
                            className={textareaClassName}
                        />
                        <FormFieldError message={getFieldError("pickupAddress")} />
                    </div>

                    <label
                        htmlFor="savePickupLocation"
                        className={cn("flex items-center gap-2 text-sm", {
                            "text-destructive": Boolean(getFieldError("savePickupLocation")),
                        })}
                    >
                        <input
                            id="savePickupLocation"
                            type="checkbox"
                            name="savePickupLocation"
                            checked={values.savePickupLocation}
                            onChange={(event) =>
                                onChange({ savePickupLocation: event.target.checked })
                            }
                            className="h-4 w-4"
                        />
                        Save/Update this location in the merchant&apos;s address book
                    </label>
                    <FormFieldError message={getFieldError("savePickupLocation")} />
                </div>
            ) : (
                <>
                    <input
                        type="hidden"
                        name="pickupLocationLabel"
                        value={values.pickupLocationLabel}
                    />
                    <input type="hidden" name="pickupTownshipId" value={values.pickupTownshipId} />
                    <input type="hidden" name="pickupAddress" value={values.pickupAddress} />
                    <input
                        type="hidden"
                        name="savePickupLocation"
                        value={values.savePickupLocation ? "true" : "false"}
                    />
                </>
            )}
        </div>
    );
}
