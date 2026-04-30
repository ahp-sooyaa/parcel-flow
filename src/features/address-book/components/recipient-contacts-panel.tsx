"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    bulkDeleteRecipientContactsAction,
    createRecipientContactAction,
    deleteRecipientContactAction,
    updateRecipientContactAction,
} from "@/features/address-book/server/actions";
import { cn } from "@/lib/utils";

import type { AddressBookActionResult } from "@/features/address-book/server/dto";
import type { MerchantContactManagementDto } from "@/features/merchant-contacts/server/dto";

const initialState: AddressBookActionResult = {
    ok: true,
    message: "",
    fieldErrors: undefined,
};

type RecipientContactsPanelProps = {
    merchantId: string;
    contacts: MerchantContactManagementDto[];
    townships: {
        id: string;
        label: string;
    }[];
};

function ContactEditor({
    action,
    merchantId,
    townships,
    defaults,
    submitLabel,
    title,
}: Readonly<{
    action: (
        prevState: AddressBookActionResult,
        formData: FormData,
    ) => Promise<AddressBookActionResult>;
    merchantId: string;
    townships: {
        id: string;
        label: string;
    }[];
    defaults?: {
        contactId?: string;
        contactLabel?: string;
        recipientName?: string;
        recipientPhone?: string;
        recipientTownshipId?: string;
        recipientAddress?: string;
    };
    submitLabel: string;
    title: string;
}>) {
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [state, formAction, isPending] = useActionState(action, initialState);

    useEffect(() => {
        if (!state.message) {
            return;
        }

        if (state.ok && !defaults?.contactId) {
            formRef.current?.reset();
        }

        if (state.ok) {
            router.refresh();
        }
    }, [defaults?.contactId, router, state.message, state.ok]);

    return (
        <form ref={formRef} action={formAction} className="space-y-4 rounded-xl border bg-card p-4">
            <div className="space-y-1">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-xs text-muted-foreground">
                    Save merchant-scoped recipient details for faster parcel entry.
                </p>
            </div>

            <input type="hidden" name="merchantId" value={merchantId} />
            {defaults?.contactId ? (
                <input type="hidden" name="contactId" value={defaults.contactId} />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor={`${submitLabel}-contact-label`}>Contact Label *</Label>
                    <Input
                        id={`${submitLabel}-contact-label`}
                        name="contactLabel"
                        defaultValue={defaults?.contactLabel}
                        required
                    />
                    <FormFieldError message={state.fieldErrors?.contactLabel?.[0]} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor={`${submitLabel}-recipient-name`}>Recipient Name *</Label>
                    <Input
                        id={`${submitLabel}-recipient-name`}
                        name="recipientName"
                        defaultValue={defaults?.recipientName}
                        required
                    />
                    <FormFieldError message={state.fieldErrors?.recipientName?.[0]} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor={`${submitLabel}-recipient-phone`}>Phone *</Label>
                    <Input
                        id={`${submitLabel}-recipient-phone`}
                        name="recipientPhone"
                        defaultValue={defaults?.recipientPhone}
                        required
                    />
                    <FormFieldError message={state.fieldErrors?.recipientPhone?.[0]} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor={`${submitLabel}-recipient-township`}>Township *</Label>
                    <select
                        id={`${submitLabel}-recipient-township`}
                        name="recipientTownshipId"
                        defaultValue={defaults?.recipientTownshipId ?? ""}
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
                    <FormFieldError message={state.fieldErrors?.recipientTownshipId?.[0]} />
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`${submitLabel}-recipient-address`}>Address *</Label>
                <textarea
                    id={`${submitLabel}-recipient-address`}
                    name="recipientAddress"
                    rows={3}
                    defaultValue={defaults?.recipientAddress}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <FormFieldError message={state.fieldErrors?.recipientAddress?.[0]} />
            </div>

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

            <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : submitLabel}
            </Button>
        </form>
    );
}

export function RecipientContactsPanel({
    merchantId,
    contacts,
    townships,
}: Readonly<RecipientContactsPanelProps>) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    return (
        <div className="space-y-5">
            <ContactEditor
                action={createRecipientContactAction}
                merchantId={merchantId}
                townships={townships}
                submitLabel="Create Contact"
                title="New Recipient Contact"
            />

            <section className="space-y-4 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">Recipient Contacts</h2>
                        <p className="text-sm text-muted-foreground">
                            Searchable merchant contacts used for parcel recipient autofill.
                        </p>
                    </div>

                    <form action={bulkDeleteRecipientContactsAction}>
                        <input type="hidden" name="merchantId" value={merchantId} />
                        {Array.from(selectedIds).map((contactId) => (
                            <input
                                key={contactId}
                                type="hidden"
                                name="contactIds"
                                value={contactId}
                            />
                        ))}
                        <Button
                            type="submit"
                            variant="destructive"
                            size="sm"
                            disabled={selectedIds.size === 0}
                        >
                            Bulk Delete
                        </Button>
                    </form>
                </div>

                <div className="overflow-hidden rounded-xl border">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/40 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3">Select</th>
                                <th className="px-4 py-3">Label</th>
                                <th className="px-4 py-3">Recipient</th>
                                <th className="px-4 py-3">Phone</th>
                                <th className="px-4 py-3">Township</th>
                                <th className="px-4 py-3">Address</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contacts.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                                        No recipient contacts found for this merchant.
                                    </td>
                                </tr>
                            ) : (
                                contacts.map((contact) => (
                                    <tr key={contact.id} className="border-t align-top">
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(contact.id)}
                                                onChange={(event) => {
                                                    setSelectedIds((current) => {
                                                        const next = new Set(current);

                                                        if (event.target.checked) {
                                                            next.add(contact.id);
                                                        } else {
                                                            next.delete(contact.id);
                                                        }

                                                        return next;
                                                    });
                                                }}
                                                className="h-4 w-4"
                                            />
                                        </td>
                                        <td className="px-4 py-3 font-medium">
                                            {contact.contactLabel}
                                        </td>
                                        <td className="px-4 py-3">{contact.recipientName}</td>
                                        <td className="px-4 py-3">{contact.recipientPhone}</td>
                                        <td className="px-4 py-3">
                                            {contact.recipientTownshipName ?? "-"}
                                        </td>
                                        <td className="px-4 py-3">{contact.recipientAddress}</td>
                                        <td className="px-4 py-3">
                                            <div className="space-y-2">
                                                <details className="rounded-lg border bg-muted/10 p-2">
                                                    <summary className="cursor-pointer text-sm font-medium">
                                                        Edit
                                                    </summary>
                                                    <div className="mt-3">
                                                        <ContactEditor
                                                            action={updateRecipientContactAction}
                                                            merchantId={merchantId}
                                                            townships={townships}
                                                            defaults={{
                                                                contactId: contact.id,
                                                                contactLabel: contact.contactLabel,
                                                                recipientName:
                                                                    contact.recipientName,
                                                                recipientPhone:
                                                                    contact.recipientPhone,
                                                                recipientTownshipId:
                                                                    contact.recipientTownshipId,
                                                                recipientAddress:
                                                                    contact.recipientAddress,
                                                            }}
                                                            submitLabel="Save Changes"
                                                            title={`Edit ${contact.contactLabel}`}
                                                        />
                                                    </div>
                                                </details>

                                                <form action={deleteRecipientContactAction}>
                                                    <input
                                                        type="hidden"
                                                        name="merchantId"
                                                        value={merchantId}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name="contactId"
                                                        value={contact.id}
                                                    />
                                                    <Button
                                                        type="submit"
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        Delete
                                                    </Button>
                                                </form>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
