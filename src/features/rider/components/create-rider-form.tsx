"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { YANGON_TOWNSHIPS } from "@/features/merchant/constants";
import { createRiderAction } from "@/features/rider/server/actions";

import type { RiderLinkableUserDto } from "@/features/rider/server/dto";

const initialState = {
  ok: true,
  message: "",
  riderId: undefined,
};

type CreateRiderFormProps = {
  linkableUsers: RiderLinkableUserDto[];
};

export function CreateRiderForm({ linkableUsers }: Readonly<CreateRiderFormProps>) {
  const [state, action, isPending] = useActionState(createRiderAction, initialState);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="rider-code">Rider Code</Label>
        <Input id="rider-code" name="riderCode" placeholder="RDR-0001" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rider-full-name">Rider Full Name</Label>
        <Input id="rider-full-name" name="fullName" placeholder="Enter rider full name" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rider-phone">Phone Number (Optional)</Label>
        <Input id="rider-phone" name="phoneNumber" placeholder="09xxxxxxxxx" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rider-address">Address</Label>
        <Input id="rider-address" name="address" placeholder="No, Street, Ward" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rider-township">Township</Label>
        <select
          id="rider-township"
          name="township"
          className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          defaultValue={YANGON_TOWNSHIPS[0]}
          required
        >
          {YANGON_TOWNSHIPS.map((township) => (
            <option key={township} value={township}>
              {township}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rider-notes">Notes (Optional)</Label>
        <textarea
          id="rider-notes"
          name="notes"
          rows={4}
          placeholder="Operational notes"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="linked-app-user">Linked App User (Optional)</Label>
        <select
          id="linked-app-user"
          name="linkedAppUserId"
          className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          defaultValue=""
        >
          <option value="">No linked user</option>
          {linkableUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.fullName} ({user.email})
            </option>
          ))}
        </select>
      </div>

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
        </div>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Rider"}
      </Button>
    </form>
  );
}
