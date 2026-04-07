"use client";

import { useState, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_SLUGS } from "@/db/constants";
import { createUserAction } from "@/features/users/server/actions";

const roleLabels: Record<(typeof ROLE_SLUGS)[number], string> = {
  super_admin: "Super Admin",
  office_admin: "Office Admin",
  rider: "Rider",
  merchant: "Merchant",
};

const initialState = {
  ok: true,
  message: "",
  temporaryPassword: undefined,
};

type CreateUserFormProps = {
  canCreateSuperAdmin: boolean;
  defaultRole?: (typeof ROLE_SLUGS)[number];
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
  const selectableRoles: readonly (typeof ROLE_SLUGS)[number][] = canCreateSuperAdmin
    ? ROLE_SLUGS
    : ROLE_SLUGS.filter((role) => role !== "super_admin");
  const safeDefaultRole = selectableRoles.includes(defaultRole) ? defaultRole : selectableRoles[0];
  const [selectedRole, setSelectedRole] = useState<(typeof ROLE_SLUGS)[number]>(safeDefaultRole);
  const showMerchantFields = selectedRole === "merchant";
  const showRiderFields = selectedRole === "rider";

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="full-name">Full Name</Label>
        <Input id="full-name" name="fullName" placeholder="Enter full name" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="name@company.com" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="phone-number">Phone Number (Contact)</Label>
        <Input id="phone-number" name="phoneNumber" placeholder="09xxxxxxxxx" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value as (typeof ROLE_SLUGS)[number])}
          required
        >
          {selectableRoles.map((roleSlug) => (
            <option key={roleSlug} value={roleSlug}>
              {roleLabels[roleSlug]}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" /> User is active
      </label>

      {showMerchantFields && (
        <div className="space-y-5 rounded-xl border bg-muted/30 p-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Merchant Profile</h2>
            <p className="text-xs text-muted-foreground">
              Leave optional fields blank to use defaults or null values.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="merchant-shop-name">Shop Name (Optional)</Label>
            <Input
              id="merchant-shop-name"
              name="merchantShopName"
              placeholder="Defaults to user full name"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="merchant-pickup-township">Pickup Township (Optional)</Label>
            <select
              id="merchant-pickup-township"
              name="merchantPickupTownshipId"
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="merchant-default-pickup-address">
              Default Pickup Address (Optional)
            </Label>
            <Input
              id="merchant-default-pickup-address"
              name="merchantDefaultPickupAddress"
              placeholder="No, Street, Ward"
            />
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
          </div>
        </div>
      )}

      {showRiderFields && (
        <div className="space-y-5 rounded-xl border bg-muted/30 p-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Rider Profile</h2>
            <p className="text-xs text-muted-foreground">
              Vehicle type defaults to bike and rider operational status defaults to active.
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rider-vehicle-type">Vehicle Type (Optional)</Label>
            <Input id="rider-vehicle-type" name="riderVehicleType" placeholder="Defaults to bike" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rider-license-plate">License Plate (Optional)</Label>
            <Input id="rider-license-plate" name="riderLicensePlate" placeholder="License plate" />
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
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="riderIsActive" defaultChecked className="h-4 w-4" /> Rider
            is operationally active
          </label>
        </div>
      )}

      {state.message && (
        <div
          className={
            state.ok
              ? "rounded-lg border border-emerald-300 bg-emerald-50 p-3"
              : "rounded-lg border border-red-300 bg-red-50 p-3"
          }
        >
          <p className={state.ok ? "text-xs text-emerald-800" : "text-xs text-destructive"}>
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
