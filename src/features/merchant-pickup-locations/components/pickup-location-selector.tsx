"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Label } from "@/components/ui/label";
import { searchMerchantPickupLocationsAction } from "@/features/merchant-pickup-locations/server/actions";

import type { MerchantPickupLocationDto } from "@/features/merchant-pickup-locations/server/dto";

export type PickupLocationSelectorValue = {
    pickupLocationId: string;
    pickupLocationLabel: string;
    pickupTownshipId: string;
    pickupAddress: string;
};

type PickupLocationSelectorProps = {
    merchantId: string;
    townships: {
        id: string;
        label: string;
    }[];
    value: PickupLocationSelectorValue;
    onChange: (next: PickupLocationSelectorValue) => void;
    fieldErrors?: Partial<Record<string, string[]>>;
};

const emptyValue: PickupLocationSelectorValue = {
    pickupLocationId: "",
    pickupLocationLabel: "",
    pickupTownshipId: "",
    pickupAddress: "",
};

export function PickupLocationSelector({
    merchantId,
    townships,
    value,
    onChange,
    fieldErrors,
}: Readonly<PickupLocationSelectorProps>) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<MerchantPickupLocationDto[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const previousMerchantIdRef = useRef(merchantId);
    const getFieldError = (fieldName: string) => fieldErrors?.[fieldName]?.[0];
    const selectedTownship =
        townships.find((township) => township.id === value.pickupTownshipId)?.label ?? null;

    useEffect(() => {
        if (previousMerchantIdRef.current === merchantId) {
            return;
        }

        previousMerchantIdRef.current = merchantId;
        setSearchQuery("");
        setSearchResults([]);
        onChange(emptyValue);
    }, [merchantId, onChange]);

    useEffect(() => {
        if (value.pickupLocationId && value.pickupLocationLabel) {
            setSearchQuery(value.pickupLocationLabel);
        }
    }, [value.pickupLocationId, value.pickupLocationLabel]);

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

                    if (!value.pickupLocationId && !searchQuery.trim()) {
                        const defaultLocation = results.find((result) => result.isDefault);

                        if (defaultLocation) {
                            onChange({
                                pickupLocationId: defaultLocation.id,
                                pickupLocationLabel: defaultLocation.label,
                                pickupTownshipId: defaultLocation.townshipId,
                                pickupAddress: defaultLocation.pickupAddress,
                            });
                        }
                    }
                })
                .finally(() => {
                    setIsSearching(false);
                });
        }, 250);

        return () => clearTimeout(timeoutId);
    }, [merchantId, onChange, searchQuery, value.pickupLocationId]);

    return (
        <div className="space-y-3 rounded-xl border bg-background p-4">
            <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="pickupLocationId">Pickup Location *</Label>
                    {isSearching ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <LoaderCircleIcon className="size-3 animate-spin" />
                            Searching...
                        </span>
                    ) : null}
                </div>
                <SearchableCombobox
                    id="pickupLocationId"
                    name="pickupLocationSearch"
                    value={value.pickupLocationId}
                    onValueChange={(nextValue) => {
                        const selectedLocation =
                            searchResults.find((result) => result.id === nextValue) ?? null;

                        if (!selectedLocation) {
                            onChange(emptyValue);
                            return;
                        }

                        onChange({
                            pickupLocationId: selectedLocation.id,
                            pickupLocationLabel: selectedLocation.label,
                            pickupTownshipId: selectedLocation.townshipId,
                            pickupAddress: selectedLocation.pickupAddress,
                        });
                        setSearchQuery(selectedLocation.label);
                    }}
                    onInputValueChange={(nextValue) => {
                        setSearchQuery(nextValue);

                        if (value.pickupLocationId) {
                            onChange(emptyValue);
                        }
                    }}
                    options={searchResults.map((location) => ({
                        value: location.id,
                        label: location.isDefault ? `${location.label} (Default)` : location.label,
                    }))}
                    placeholder={merchantId ? "Search pickup location" : "Select merchant first"}
                    emptyLabel={
                        merchantId
                            ? "No pickup locations found."
                            : "Select a merchant to search pickup locations."
                    }
                    required
                    disabled={!merchantId}
                    invalid={Boolean(getFieldError("pickupLocationId"))}
                />
                <input type="hidden" name="pickupLocationId" value={value.pickupLocationId} />
                <input type="hidden" name="pickupLocationLabel" value={value.pickupLocationLabel} />
                <input type="hidden" name="pickupTownshipId" value={value.pickupTownshipId} />
                <input type="hidden" name="pickupAddress" value={value.pickupAddress} />
                <FormFieldError message={getFieldError("pickupLocationId")} />
            </div>

            {value.pickupLocationId ? (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                    <p className="font-semibold">{value.pickupLocationLabel}</p>
                    <p>{selectedTownship ?? "No township selected"}</p>
                    <p className="text-muted-foreground">{value.pickupAddress}</p>
                </div>
            ) : (
                <p className="text-xs text-muted-foreground">
                    Select a saved pickup location from the merchant&apos;s address book.
                </p>
            )}
        </div>
    );
}
