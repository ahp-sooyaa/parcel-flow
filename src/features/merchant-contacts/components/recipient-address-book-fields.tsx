"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchMerchantContactsAction } from "@/features/merchant-contacts/server/actions";
import { cn } from "@/lib/utils";

import type { MerchantContactSearchResultDto } from "@/features/merchant-contacts/server/dto";

export type RecipientAddressBookFieldsValue = {
    selectedMerchantContactId: string;
    contactLabel: string;
    saveRecipientContact: boolean;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
};

type RecipientAddressBookFieldsProps = {
    merchantId: string;
    townships: {
        id: string;
        label: string;
    }[];
    values: RecipientAddressBookFieldsValue;
    onChange: (next: Partial<RecipientAddressBookFieldsValue>) => void;
    fieldErrors?: Partial<Record<string, string[]>>;
};

const textareaClassName =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function normalizeComparableText(value: string) {
    return value.trim().toLocaleLowerCase();
}

function matchesRecipientDetails(
    contact: MerchantContactSearchResultDto,
    values: RecipientAddressBookFieldsValue,
) {
    return (
        normalizeComparableText(contact.recipientName) ===
            normalizeComparableText(values.recipientName) &&
        normalizeComparableText(contact.recipientPhone) ===
            normalizeComparableText(values.recipientPhone) &&
        contact.recipientTownshipId === values.recipientTownshipId &&
        normalizeComparableText(contact.recipientAddress) ===
            normalizeComparableText(values.recipientAddress)
    );
}

export function RecipientAddressBookFields({
    merchantId,
    townships,
    values,
    onChange,
    fieldErrors,
}: Readonly<RecipientAddressBookFieldsProps>) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<MerchantContactSearchResultDto[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [detailsExpanded, setDetailsExpanded] = useState(!values.selectedMerchantContactId);
    const previousMerchantIdRef = useRef(merchantId);
    const selectedContact =
        searchResults.find((contact) => contact.id === values.selectedMerchantContactId) ?? null;
    const selectedTownship =
        townships.find((township) => township.id === values.recipientTownshipId)?.label ?? null;
    const hasSelectedContact = Boolean(values.selectedMerchantContactId);
    const shouldShowDetails = !hasSelectedContact || detailsExpanded;
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
            selectedMerchantContactId: "",
        });
    }, [merchantId, onChange]);

    useEffect(() => {
        if (values.selectedMerchantContactId && values.contactLabel) {
            setSearchQuery(values.contactLabel);
        }
    }, [values.contactLabel, values.selectedMerchantContactId]);

    useEffect(() => {
        if (!merchantId) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const timeoutId = setTimeout(() => {
            setIsSearching(true);

            void searchMerchantContactsAction({
                merchantId,
                query: searchQuery,
            })
                .then((results) => {
                    setSearchResults(results);

                    if (
                        values.selectedMerchantContactId ||
                        values.contactLabel ||
                        searchQuery.trim() ||
                        !values.recipientName ||
                        !values.recipientPhone ||
                        !values.recipientTownshipId ||
                        !values.recipientAddress
                    ) {
                        return;
                    }

                    const matchedContact =
                        results.find((contact) => matchesRecipientDetails(contact, values)) ?? null;

                    if (!matchedContact) {
                        return;
                    }

                    onChange({
                        selectedMerchantContactId: matchedContact.id,
                        contactLabel: matchedContact.contactLabel,
                    });
                    setSearchQuery(matchedContact.contactLabel);
                    setDetailsExpanded(false);
                })
                .finally(() => {
                    setIsSearching(false);
                });
        }, 250);

        return () => clearTimeout(timeoutId);
    }, [merchantId, onChange, searchQuery, values]);

    return (
        <div className="space-y-4">
            <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="selectedMerchantContactId">Search Contact</Label>
                    {isSearching ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <LoaderCircleIcon className="size-3 animate-spin" />
                            Searching...
                        </span>
                    ) : null}
                </div>
                <SearchableCombobox
                    id="selectedMerchantContactId"
                    name="merchantContactSearch"
                    value={values.selectedMerchantContactId}
                    onValueChange={(nextValue) => {
                        const nextContact =
                            searchResults.find((contact) => contact.id === nextValue) ?? null;

                        if (!nextContact) {
                            onChange({
                                selectedMerchantContactId: "",
                            });
                            return;
                        }

                        onChange({
                            selectedMerchantContactId: nextContact.id,
                            contactLabel: nextContact.contactLabel,
                            saveRecipientContact: false,
                            recipientName: nextContact.recipientName,
                            recipientPhone: nextContact.recipientPhone,
                            recipientTownshipId: nextContact.recipientTownshipId,
                            recipientAddress: nextContact.recipientAddress,
                        });
                        setSearchQuery(nextContact.contactLabel);
                        setDetailsExpanded(false);
                    }}
                    onInputValueChange={(nextValue) => {
                        setSearchQuery(nextValue);

                        if (values.selectedMerchantContactId) {
                            onChange({
                                selectedMerchantContactId: "",
                            });
                            setDetailsExpanded(true);
                        }
                    }}
                    options={searchResults.map((contact) => ({
                        value: contact.id,
                        label: contact.contactLabel,
                    }))}
                    placeholder={merchantId ? "Search saved contact" : "Select merchant first"}
                    emptyLabel={
                        merchantId
                            ? "No saved contacts found."
                            : "Select a merchant to search saved contacts."
                    }
                    allowClear
                    disabled={!merchantId}
                    invalid={Boolean(getFieldError("selectedMerchantContactId"))}
                />
                <input
                    type="hidden"
                    name="selectedMerchantContactId"
                    value={values.selectedMerchantContactId}
                />
                <FormFieldError message={getFieldError("selectedMerchantContactId")} />
            </div>

            {hasSelectedContact ? (
                <div className="rounded-xl border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 text-sm">
                            <p className="font-semibold">
                                {values.contactLabel || selectedContact?.contactLabel}
                            </p>
                            <p>{values.recipientName}</p>
                            <p>{values.recipientPhone}</p>
                            <p>{selectedTownship ?? "No township selected"}</p>
                            <p className="text-muted-foreground">{values.recipientAddress}</p>
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
                        <Label htmlFor="contactLabel">Contact Label</Label>
                        <Input
                            id="contactLabel"
                            name="contactLabel"
                            value={values.contactLabel}
                            onChange={(event) => onChange({ contactLabel: event.target.value })}
                            placeholder="Customer label for address book"
                        />
                        <FormFieldError message={getFieldError("contactLabel")} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="recipientName">Recipient Name *</Label>
                            <Input
                                id="recipientName"
                                name="recipientName"
                                value={values.recipientName}
                                onChange={(event) =>
                                    onChange({ recipientName: event.target.value })
                                }
                                placeholder="Receiver full name"
                                required
                            />
                            <FormFieldError message={getFieldError("recipientName")} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="recipientPhone">Recipient Phone *</Label>
                            <Input
                                id="recipientPhone"
                                name="recipientPhone"
                                value={values.recipientPhone}
                                onChange={(event) =>
                                    onChange({ recipientPhone: event.target.value })
                                }
                                placeholder="09xxxxxxxxx"
                                required
                            />
                            <FormFieldError message={getFieldError("recipientPhone")} />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="recipientTownshipId">Recipient Township *</Label>
                        <select
                            id="recipientTownshipId"
                            name="recipientTownshipId"
                            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            value={values.recipientTownshipId}
                            onChange={(event) =>
                                onChange({ recipientTownshipId: event.target.value })
                            }
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
                            value={values.recipientAddress}
                            onChange={(event) => onChange({ recipientAddress: event.target.value })}
                            required
                            className={textareaClassName}
                        />
                        <FormFieldError message={getFieldError("recipientAddress")} />
                    </div>

                    <label
                        htmlFor="saveRecipientContact"
                        className={cn("flex items-center gap-2 text-sm", {
                            "text-destructive": Boolean(getFieldError("saveRecipientContact")),
                        })}
                    >
                        <input
                            id="saveRecipientContact"
                            type="checkbox"
                            name="saveRecipientContact"
                            checked={values.saveRecipientContact}
                            onChange={(event) =>
                                onChange({ saveRecipientContact: event.target.checked })
                            }
                            className="h-4 w-4"
                        />
                        Save/Update this contact in the merchant&apos;s address book
                    </label>
                    <FormFieldError message={getFieldError("saveRecipientContact")} />
                </div>
            ) : (
                <>
                    <input type="hidden" name="contactLabel" value={values.contactLabel} />
                    <input type="hidden" name="recipientName" value={values.recipientName} />
                    <input type="hidden" name="recipientPhone" value={values.recipientPhone} />
                    <input
                        type="hidden"
                        name="recipientTownshipId"
                        value={values.recipientTownshipId}
                    />
                    <input type="hidden" name="recipientAddress" value={values.recipientAddress} />
                    <input
                        type="hidden"
                        name="saveRecipientContact"
                        value={values.saveRecipientContact ? "true" : "false"}
                    />
                </>
            )}
        </div>
    );
}
