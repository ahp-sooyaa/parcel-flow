"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
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
    merchantId: string;
    pickupLocations: MerchantPickupLocationDto[];
    townships: {
        id: string;
        label: string;
    }[];
};

function PickupLocationEditor({
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
    defaults?: MerchantPickupLocationDto;
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

        if (state.ok && !defaults?.id) {
            formRef.current?.reset();
        }

        if (state.ok) {
            router.refresh();
        }
    }, [defaults?.id, router, state.message, state.ok]);

    return (
        <form ref={formRef} action={formAction} className="space-y-4 rounded-xl border bg-card p-4">
            <div className="space-y-1">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-xs text-muted-foreground">
                    Manage saved pickup locations used by parcel create and edit forms.
                </p>
            </div>

            <input type="hidden" name="merchantId" value={merchantId} />
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

            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    name="isDefault"
                    defaultChecked={defaults?.isDefault}
                    className="h-4 w-4"
                />
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
}: Readonly<PickupLocationsPanelProps>) {
    return (
        <div className="space-y-5">
            <PickupLocationEditor
                action={createPickupLocationAction}
                merchantId={merchantId}
                townships={townships}
                submitLabel="Create Pickup Location"
                title="New Pickup Location"
            />

            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">Pickup Locations</h2>
                    <p className="text-sm text-muted-foreground">
                        Manage merchant pickup points and mark one as the default parcel source.
                    </p>
                </div>

                {pickupLocations.length === 0 ? (
                    <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                        No pickup locations found for this merchant.
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {pickupLocations.map((pickupLocation) => (
                            <article
                                key={pickupLocation.id}
                                className="rounded-xl border bg-card p-4"
                            >
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-base font-semibold">
                                                    {pickupLocation.label}
                                                </h3>
                                                {pickupLocation.isDefault ? (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                        Default
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {pickupLocation.townshipName ?? "-"}
                                            </p>
                                        </div>

                                        {!pickupLocation.isDefault ? (
                                            <form action={setDefaultPickupLocationAction}>
                                                <input
                                                    type="hidden"
                                                    name="merchantId"
                                                    value={merchantId}
                                                />
                                                <input
                                                    type="hidden"
                                                    name="pickupLocationId"
                                                    value={pickupLocation.id}
                                                />
                                                <Button type="submit" size="sm" variant="outline">
                                                    Set as Default
                                                </Button>
                                            </form>
                                        ) : null}
                                    </div>

                                    <p className="text-sm">{pickupLocation.pickupAddress}</p>

                                    <details className="rounded-lg border bg-muted/10 p-2">
                                        <summary className="cursor-pointer text-sm font-medium">
                                            Edit
                                        </summary>
                                        <div className="mt-3">
                                            <PickupLocationEditor
                                                action={updatePickupLocationAction}
                                                merchantId={merchantId}
                                                townships={townships}
                                                defaults={pickupLocation}
                                                submitLabel="Save Changes"
                                                title={`Edit ${pickupLocation.label}`}
                                            />
                                        </div>
                                    </details>

                                    <form action={deletePickupLocationAction}>
                                        <input type="hidden" name="merchantId" value={merchantId} />
                                        <input
                                            type="hidden"
                                            name="pickupLocationId"
                                            value={pickupLocation.id}
                                        />
                                        <Button type="submit" size="sm" variant="outline">
                                            Delete
                                        </Button>
                                    </form>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
