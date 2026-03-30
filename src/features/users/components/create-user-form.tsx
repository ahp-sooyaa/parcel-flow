"use client";

import { useActionState } from "react";
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
};

export function CreateUserForm({ canCreateSuperAdmin }: CreateUserFormProps) {
  const [state, action, isPending] = useActionState(createUserAction, initialState);
  const selectableRoles = canCreateSuperAdmin
    ? ROLE_SLUGS
    : ROLE_SLUGS.filter((role) => role !== "super_admin");

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
          defaultValue="office_admin"
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
        <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
        User is active
      </label>

      {state.message ? (
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
          {state.temporaryPassword ? (
            <p className="mt-2 text-xs font-semibold text-amber-900">
              Temporary password (show once):{" "}
              <span className="font-mono">{state.temporaryPassword}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create User"}
      </Button>
    </form>
  );
}
