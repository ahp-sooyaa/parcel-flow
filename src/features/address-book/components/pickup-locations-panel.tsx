"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    bulkDeletePickupLocationsAction,
    createPickupLocationAction,
    deletePickupLocationAction,
    setDefaultPickupLocationAction,
    updatePickupLocationAction,
} from "@/features/address-book/server/actions";
import { cn } from "@/lib/utils";

import type { AddressBookActionResult } from "@/features/address-book/server/dto";
import type { MerchantPickupLocationDto } from "@/features/merchant-pickup-locations/server/dto";

const initialState: AddressBookActionResult = {
    ok: true,
    message: "",
    fieldErrors: undefined,
};

type PickupLocationsPanelProps = {
    merchantId: string | null;
    pickupLocations: MerchantPickupLocationDto[];
    townships: {
        id: string;
        label: string;
    }[];
    merchants: {
        id: string;
        label: string;
    }[];
    showMerchantColumn?: boolean;
};

function PickupLocationEditor({
    action,
    merchantId,
    townships,
    merchants,
    defaults,
    submitLabel,
    title,
    onSuccess,
    showHeader,
    formClassName,
}: Readonly<{
    action: (
        prevState: AddressBookActionResult,
        formData: FormData,
    ) => Promise<AddressBookActionResult>;
    merchantId: string | null;
    townships: {
        id: string;
        label: string;
    }[];
    merchants: {
        id: string;
        label: string;
    }[];
    defaults?: MerchantPickupLocationDto;
    submitLabel: string;
    title: string;
    showHeader?: boolean;
    formClassName?: string;
    onSuccess?: () => void;
}>) {
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [state, formAction, isPending] = useActionState(action, initialState);

    useEffect(() => {
        if (!state.message) {
            return;
        }

        if (state.ok && !defaults?.id) {
            formRef.current?.reset();
        }

        if (state.ok) {
            onSuccess?.();
            router.refresh();
        }
    }, [defaults?.id, onSuccess, router, state.message, state.ok]);

    return (
        <form
            ref={formRef}
            action={formAction}
            className={cn("space-y-4 rounded-xl border bg-card p-4", formClassName)}
        >
            {showHeader === false ? null : (
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="text-xs text-muted-foreground">
                        Manage saved pickup locations used by parcel create and edit forms.
                    </p>
                </div>
            )}

            {merchantId ? (
                <input type="hidden" name="merchantId" value={merchantId} />
            ) : (
                <div className="grid gap-2">
                    <Label htmlFor={`${submitLabel}-merchant-id`}>Merchant *</Label>
                    <select
                        id={`${submitLabel}-merchant-id`}
                        name="merchantId"
                        defaultValue={defaults?.merchantId ?? ""}
                        className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        required
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
                    <FormFieldError message={state.fieldErrors?.merchantId?.[0]} />
                </div>
            )}
            {defaults?.id ? (
                <input type="hidden" name="pickupLocationId" value={defaults.id} />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor={`${submitLabel}-pickup-label`}>Location Label *</Label>
                    <Input
                        id={`${submitLabel}-pickup-label`}
                        name="label"
                        defaultValue={defaults?.label}
                        required
                    />
                    <FormFieldError message={state.fieldErrors?.label?.[0]} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${submitLabel}-pickup-township`}>Township *</Label>
                    <select
                        id={`${submitLabel}-pickup-township`}
                        name="townshipId"
                        defaultValue={defaults?.townshipId ?? ""}
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
                    <FormFieldError message={state.fieldErrors?.townshipId?.[0]} />
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor={`${submitLabel}-pickup-address`}>Pickup Address *</Label>
                <textarea
                    id={`${submitLabel}-pickup-address`}
                    name="pickupAddress"
                    rows={3}
                    defaultValue={defaults?.pickupAddress}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <FormFieldError message={state.fieldErrors?.pickupAddress?.[0]} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor={`${submitLabel}-pickup-contact-name`}>
                        Pickup Contact Name *
                    </Label>
                    <Input
                        id={`${submitLabel}-pickup-contact-name`}
                        name="contactName"
                        defaultValue={defaults?.contactName ?? ""}
                        required
                    />
                    <FormFieldError message={state.fieldErrors?.contactName?.[0]} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${submitLabel}-pickup-contact-phone`}>
                        Pickup Contact Phone *
                    </Label>
                    <Input
                        id={`${submitLabel}-pickup-contact-phone`}
                        name="contactPhone"
                        defaultValue={defaults?.contactPhone ?? ""}
                        required
                    />
                    <FormFieldError message={state.fieldErrors?.contactPhone?.[0]} />
                </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    name="isDefault"
                    defaultChecked={defaults?.isDefault}
                    className="h-4 w-4"
                />{" "}
                Set as default
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

            <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : submitLabel}
            </Button>
        </form>
    );
}

export function PickupLocationsPanel({
    merchantId,
    pickupLocations,
    townships,
    merchants,
    showMerchantColumn = false,
}: Readonly<PickupLocationsPanelProps>) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editingPickupLocation, setEditingPickupLocation] =
        useState<MerchantPickupLocationDto | null>(null);

    return (
        <div className="space-y-5">
            <section className="rounded-xl border bg-card">
                <div className="border-b px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">Pickup Locations</h2>
                            <p className="text-sm text-muted-foreground">
                                Manage merchant pickup points and mark one as the default parcel
                                source.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setCreateDialogOpen(true)}
                            >
                                Create Pickup Location
                            </Button>

                            <form action={bulkDeletePickupLocationsAction}>
                                {Array.from(selectedIds).map((pickupLocationId) => (
                                    <input
                                        key={pickupLocationId}
                                        type="hidden"
                                        name="pickupLocationSelections"
                                        value={`${pickupLocations.find((pickupLocation) => pickupLocation.id === pickupLocationId)?.merchantId ?? ""}:${pickupLocationId}`}
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
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/40 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3">Select</th>
                                {showMerchantColumn ? (
                                    <th className="px-4 py-3">Merchant</th>
                                ) : null}
                                <th className="px-4 py-3">Label</th>
                                <th className="px-4 py-3">Township</th>
                                <th className="px-4 py-3">Pickup Contact</th>
                                <th className="px-4 py-3">Address</th>
                                <th className="px-4 py-3">Default</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pickupLocations.length === 0 ? (
                                <tr>
                                    <td
                                        className="px-4 py-6 text-muted-foreground"
                                        colSpan={showMerchantColumn ? 8 : 7}
                                    >
                                        No pickup locations found.
                                    </td>
                                </tr>
                            ) : (
                                pickupLocations.map((pickupLocation) => (
                                    <tr key={pickupLocation.id} className="border-t">
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(pickupLocation.id)}
                                                onChange={(event) => {
                                                    setSelectedIds((current) => {
                                                        const next = new Set(current);

                                                        if (event.target.checked) {
                                                            next.add(pickupLocation.id);
                                                        } else {
                                                            next.delete(pickupLocation.id);
                                                        }

                                                        return next;
                                                    });
                                                }}
                                                className="h-4 w-4"
                                            />
                                        </td>
                                        {showMerchantColumn ? (
                                            <td className="px-4 py-3">
                                                {pickupLocation.merchantLabel ?? "-"}
                                            </td>
                                        ) : null}
                                        <td className="px-4 py-3 font-medium">
                                            {pickupLocation.label}
                                        </td>
                                        <td className="px-4 py-3">
                                            {pickupLocation.townshipName ?? "-"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>{pickupLocation.contactName ?? "-"}</div>
                                            <div className="text-muted-foreground">
                                                {pickupLocation.contactPhone ?? "-"}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {pickupLocation.pickupAddress}
                                        </td>
                                        <td className="px-4 py-3">
                                            {pickupLocation.isDefault ? (
                                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                    Default
                                                </span>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                {!pickupLocation.isDefault ? (
                                                    <form action={setDefaultPickupLocationAction}>
                                                        <input
                                                            type="hidden"
                                                            name="merchantId"
                                                            value={pickupLocation.merchantId}
                                                        />
                                                        <input
                                                            type="hidden"
                                                            name="pickupLocationId"
                                                            value={pickupLocation.id}
                                                        />
                                                        <Button
                                                            type="submit"
                                                            size="sm"
                                                            variant="outline"
                                                        >
                                                            Set as Default
                                                        </Button>
                                                    </form>
                                                ) : null}

                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setEditingPickupLocation(pickupLocation)
                                                    }
                                                >
                                                    Edit
                                                </Button>

                                                <form action={deletePickupLocationAction}>
                                                    <input
                                                        type="hidden"
                                                        name="merchantId"
                                                        value={pickupLocation.merchantId}
                                                    />
                                                    <input
                                                        type="hidden"
                                                        name="pickupLocationId"
                                                        value={pickupLocation.id}
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

            <Sheet open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <SheetContent
                    side="bottom"
                    className="max-h-[90vh] rounded-t-2xl border-x-0 border-b-0"
                >
                    <SheetHeader className="pr-8">
                        <SheetTitle>New Pickup Location</SheetTitle>
                        <SheetDescription>
                            Manage saved pickup locations used by parcel create and edit forms.
                        </SheetDescription>
                    </SheetHeader>

                    <PickupLocationEditor
                        action={createPickupLocationAction}
                        merchantId={merchantId}
                        townships={townships}
                        merchants={merchants}
                        submitLabel="Create Pickup Location"
                        title="New Pickup Location"
                        showHeader={false}
                        formClassName="rounded-none border-0 bg-transparent p-0"
                        onSuccess={() => setCreateDialogOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            <Sheet
                open={Boolean(editingPickupLocation)}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingPickupLocation(null);
                    }
                }}
            >
                <SheetContent
                    side="bottom"
                    className="max-h-[90vh] rounded-t-2xl border-x-0 border-b-0"
                >
                    <SheetHeader className="pr-8">
                        <SheetTitle>
                            {editingPickupLocation
                                ? `Edit ${editingPickupLocation.label}`
                                : "Edit Pickup Location"}
                        </SheetTitle>
                        <SheetDescription>
                            Manage saved pickup locations used by parcel create and edit forms.
                        </SheetDescription>
                    </SheetHeader>

                    {editingPickupLocation ? (
                        <PickupLocationEditor
                            action={updatePickupLocationAction}
                            merchantId={editingPickupLocation.merchantId}
                            townships={townships}
                            merchants={merchants}
                            defaults={editingPickupLocation}
                            submitLabel="Save Changes"
                            title={`Edit ${editingPickupLocation.label}`}
                            showHeader={false}
                            formClassName="rounded-none border-0 bg-transparent p-0"
                            onSuccess={() => setEditingPickupLocation(null)}
                        />
                    ) : null}
                </SheetContent>
            </Sheet>
        </div>
    );
}
