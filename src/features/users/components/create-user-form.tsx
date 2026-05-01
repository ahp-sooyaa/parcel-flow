"use client";

import { useState, useActionState } from "react";
import { FormFieldError } from "@/components/shared/form-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_SLUGS, type RoleSlug } from "@/db/constants";
import { createUserAction } from "@/features/users/server/actions";
import { formatRoleSlug } from "@/lib/roles";
import { cn } from "@/lib/utils";

const initialState = {
    ok: true,
    message: "",
    temporaryPassword: undefined,
    fieldErrors: undefined,
};

type CreateUserFormProps = {
    canCreateSuperAdmin: boolean;
    defaultRole?: RoleSlug;
    townships: {
        id: string;
        name: string;
    }[];
};

export function CreateUserForm({
    canCreateSuperAdmin,
    defaultRole = "office_admin",
    townships,
}: Readonly<CreateUserFormProps>) {
    const [state, action, isPending] = useActionState(createUserAction, initialState);
    const selectableRoles: readonly RoleSlug[] = canCreateSuperAdmin
        ? ROLE_SLUGS
        : ROLE_SLUGS.filter((role) => role !== "super_admin");
    const safeDefaultRole = selectableRoles.includes(defaultRole)
        ? defaultRole
        : selectableRoles[0];
    const [selectedRole, setSelectedRole] = useState<RoleSlug>(safeDefaultRole);
    const showMerchantFields = selectedRole === "merchant";
    const showRiderFields = selectedRole === "rider";
    const getFieldError = (fieldName: string) => state.fieldErrors?.[fieldName]?.[0];

    return (
        <form action={action} className="space-y-5">
            <div className="grid gap-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input id="full-name" name="fullName" placeholder="Enter full name" required />
                <FormFieldError message={getFieldError("fullName")} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@company.com"
                    required
                />
                <FormFieldError message={getFieldError("email")} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="phone-number">Phone Number (Contact)</Label>
                <Input id="phone-number" name="phoneNumber" placeholder="09xxxxxxxxx" />
                <FormFieldError message={getFieldError("phoneNumber")} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <select
                    id="role"
                    name="role"
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value as RoleSlug)}
                    required
                >
                    {selectableRoles.map((roleSlug) => (
                        <option key={roleSlug} value={roleSlug}>
                            {formatRoleSlug(roleSlug)}
                        </option>
                    ))}
                </select>
                <FormFieldError message={getFieldError("role")} />
            </div>

            <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" /> User is
                active
            </label>

            {showMerchantFields && (
                <div className="space-y-5 rounded-xl border bg-muted/30 p-4">
                    <div className="space-y-1">
                        <h2 className="text-sm font-semibold">Merchant Profile</h2>
                        <p className="text-xs text-muted-foreground">
                            Set the merchant's first default pickup location during account
                            creation.
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="merchant-shop-name">Shop Name (Optional)</Label>
                        <Input
                            id="merchant-shop-name"
                            name="merchantShopName"
                            placeholder="Defaults to user full name"
                        />
                        <FormFieldError message={getFieldError("merchantShopName")} />
                    </div>

                    <div className="space-y-4 rounded-xl border bg-background p-4">
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold">Primary Pickup Location</h3>
                            <p className="text-xs text-muted-foreground">
                                This will be saved as the merchant&apos;s default pickup location.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="primary-pickup-label">Location Label *</Label>
                            <Input
                                id="primary-pickup-label"
                                name="primaryPickupLabel"
                                placeholder="Main shop"
                                required={showMerchantFields}
                            />
                            <FormFieldError message={getFieldError("primaryPickupLabel")} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="primary-pickup-township">Township *</Label>
                            <select
                                id="primary-pickup-township"
                                name="primaryPickupTownshipId"
                                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                defaultValue=""
                                required={showMerchantFields}
                            >
                                <option value="" disabled>
                                    Select township
                                </option>
                                {townships.map((township) => (
                                    <option key={township.id} value={township.id}>
                                        {township.name}
                                    </option>
                                ))}
                            </select>
                            <FormFieldError message={getFieldError("primaryPickupTownshipId")} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="primary-pickup-address">Address *</Label>
                            <textarea
                                id="primary-pickup-address"
                                name="primaryPickupAddress"
                                rows={3}
                                placeholder="Pickup address"
                                required={showMerchantFields}
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            />
                            <FormFieldError message={getFieldError("primaryPickupAddress")} />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="primary-pickup-contact-name">
                                    Pickup Contact Name *
                                </Label>
                                <Input
                                    id="primary-pickup-contact-name"
                                    name="primaryPickupContactName"
                                    placeholder="Main pickup contact"
                                    required={showMerchantFields}
                                />
                                <FormFieldError
                                    message={getFieldError("primaryPickupContactName")}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="primary-pickup-contact-phone">
                                    Pickup Contact Phone *
                                </Label>
                                <Input
                                    id="primary-pickup-contact-phone"
                                    name="primaryPickupContactPhone"
                                    placeholder="09xxxxxxxxx"
                                    required={showMerchantFields}
                                />
                                <FormFieldError
                                    message={getFieldError("primaryPickupContactPhone")}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="merchant-notes">Notes (Optional)</Label>
                        <textarea
                            id="merchant-notes"
                            name="merchantNotes"
                            rows={4}
                            placeholder="Merchant notes"
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                        <FormFieldError message={getFieldError("merchantNotes")} />
                    </div>
                </div>
            )}

            {showRiderFields && (
                <div className="space-y-5 rounded-xl border bg-muted/30 p-4">
                    <div className="space-y-1">
                        <h2 className="text-sm font-semibold">Rider Profile</h2>
                        <p className="text-xs text-muted-foreground">
                            Vehicle type defaults to bike and rider operational status defaults to
                            active.
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="rider-township">Township (Optional)</Label>
                        <select
                            id="rider-township"
                            name="riderTownshipId"
                            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            defaultValue=""
                        >
                            <option value="">No township selected</option>
                            {townships.map((township) => (
                                <option key={township.id} value={township.id}>
                                    {township.name}
                                </option>
                            ))}
                        </select>
                        <FormFieldError message={getFieldError("riderTownshipId")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="rider-vehicle-type">Vehicle Type (Optional)</Label>
                        <Input
                            id="rider-vehicle-type"
                            name="riderVehicleType"
                            placeholder="Defaults to bike"
                        />
                        <FormFieldError message={getFieldError("riderVehicleType")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="rider-license-plate">License Plate (Optional)</Label>
                        <Input
                            id="rider-license-plate"
                            name="riderLicensePlate"
                            placeholder="License plate"
                        />
                        <FormFieldError message={getFieldError("riderLicensePlate")} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="rider-notes">Notes (Optional)</Label>
                        <textarea
                            id="rider-notes"
                            name="riderNotes"
                            rows={4}
                            placeholder="Rider notes"
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                        <FormFieldError message={getFieldError("riderNotes")} />
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            name="riderIsActive"
                            defaultChecked
                            className="h-4 w-4"
                        />{" "}
                        Rider is operationally active
                    </label>
                </div>
            )}

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
                    {state.temporaryPassword && (
                        <p className="mt-2 text-xs font-semibold text-amber-900">
                            Temporary password (show once):{" "}
                            <span className="font-mono">{state.temporaryPassword}</span>
                        </p>
                    )}
                </div>
            )}

            <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create User"}
            </Button>
        </form>
    );
}
