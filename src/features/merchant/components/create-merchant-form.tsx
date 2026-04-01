"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { YANGON_TOWNSHIPS } from "@/features/merchant/constants";
import { createMerchantAction } from "@/features/merchant/server/actions";

import type { MerchantLinkableUserDto } from "@/features/merchant/server/dto";

const initialState = {
  ok: true,
  message: "",
  merchantId: undefined,
};

type CreateMerchantFormProps = {
  linkableUsers: MerchantLinkableUserDto[];
};

export function CreateMerchantForm({ linkableUsers }: Readonly<CreateMerchantFormProps>) {
  const [state, action, isPending] = useActionState(createMerchantAction, initialState);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="merchant-name">Merchant Name</Label>
        <Input id="merchant-name" name="name" placeholder="Enter merchant name" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="merchant-phone">Phone Number (Optional)</Label>
        <Input id="merchant-phone" name="phoneNumber" placeholder="09xxxxxxxxx" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="merchant-address">Address</Label>
        <Input id="merchant-address" name="address" placeholder="No, Street, Ward" required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="merchant-township">Township</Label>
        <select
          id="merchant-township"
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
        <Label htmlFor="merchant-notes">Notes (Optional)</Label>
        <textarea
          id="merchant-notes"
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
        {isPending ? "Creating..." : "Create Merchant"}
      </Button>
    </form>
  );
}
