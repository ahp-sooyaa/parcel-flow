"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMerchantProfileAction } from "@/features/merchant/server/actions";

type EditMerchantFormProps = {
  merchantId: string;
  shopName: string;
  contactName: string;
  email: string;
  phoneNumber: string | null;
  townshipId: string | null;
  defaultPickupAddress: string | null;
  notes: string | null;
  townships: {
    id: string;
    name: string;
  }[];
};

const initialState = {
  ok: true,
  message: "",
};

export function EditMerchantForm({
  merchantId,
  shopName,
  contactName,
  email,
  phoneNumber,
  townshipId,
  defaultPickupAddress,
  notes,
  townships,
}: Readonly<EditMerchantFormProps>) {
  const [state, action, isPending] = useActionState(updateMerchantProfileAction, initialState);
  const [values, setValues] = useState({
    shopName,
    pickupTownshipId: townshipId ?? "",
    defaultPickupAddress: defaultPickupAddress ?? "",
    notes: notes ?? "",
  });

  useEffect(() => {
    setValues({
      shopName,
      pickupTownshipId: townshipId ?? "",
      defaultPickupAddress: defaultPickupAddress ?? "",
      notes: notes ?? "",
    });
  }, [shopName, townshipId, defaultPickupAddress, notes]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="merchantId" value={merchantId} />

      <div className="grid gap-2">
        <Label htmlFor="merchant-contact-name">Contact Name</Label>
        <Input id="merchant-contact-name" value={contactName} disabled />
      </div>

      <div className="grid gap-2 md:grid-cols-2 md:gap-4">
        <div className="grid gap-2">
          <Label htmlFor="merchant-email">Email</Label>
          <Input id="merchant-email" value={email} disabled />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="merchant-phone">Phone Number</Label>
          <Input id="merchant-phone" value={phoneNumber ?? "-"} disabled />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="merchant-shop-name">Shop Name</Label>
        <Input
          id="merchant-shop-name"
          name="shopName"
          value={values.shopName}
          onChange={(event) => {
            setValues((prev) => ({
              ...prev,
              shopName: event.target.value,
            }));
          }}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="merchant-pickup-township">Pickup Township</Label>
        <select
          id="merchant-pickup-township"
          name="pickupTownshipId"
          className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={values.pickupTownshipId}
          onChange={(event) => {
            setValues((prev) => ({
              ...prev,
              pickupTownshipId: event.target.value,
            }));
          }}
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
        <Label htmlFor="merchant-default-pickup-address">Default Pickup Address</Label>
        <Input
          id="merchant-default-pickup-address"
          name="defaultPickupAddress"
          value={values.defaultPickupAddress}
          onChange={(event) => {
            setValues((prev) => ({
              ...prev,
              defaultPickupAddress: event.target.value,
            }));
          }}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="merchant-notes">Notes</Label>
        <textarea
          id="merchant-notes"
          name="notes"
          rows={4}
          value={values.notes}
          onChange={(event) => {
            setValues((prev) => ({
              ...prev,
              notes: event.target.value,
            }));
          }}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {state.message ? (
        <p className={state.ok ? "text-xs text-emerald-700" : "text-xs text-destructive"}>
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Merchant Profile"}
      </Button>
    </form>
  );
}
