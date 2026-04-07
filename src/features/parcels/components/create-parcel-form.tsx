"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_CREATE_PARCEL_STATE,
  DELIVERY_FEE_PAYERS,
  DELIVERY_FEE_STATUSES,
  PARCEL_TYPES,
} from "@/features/parcels/constants";
import { createParcelAction } from "@/features/parcels/server/actions";

type CreateParcelFormProps = {
  merchants: { id: string; label: string }[];
  riders: { id: string; label: string }[];
  townships: { id: string; label: string }[];
  merchantFieldReadOnly?: boolean;
};

const initialState = {
  ok: true,
  message: "",
  parcelId: undefined,
  fields: undefined,
};

export function CreateParcelForm({
  merchants,
  riders,
  townships,
  merchantFieldReadOnly = false,
}: Readonly<CreateParcelFormProps>) {
  const [state, action, isPending] = useActionState(createParcelAction, initialState);
  const selectedMerchant = merchants.find(
    (merchant) => merchant.id === (state.fields?.merchantId ?? ""),
  );
  const defaultMerchantId = state.fields?.merchantId ?? merchants[0]?.id ?? "";

  return (
    <form action={action} className="space-y-6">
      <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Parcel Info</h2>
          <p className="text-xs text-muted-foreground">Core parcel and receiver fields.</p>
        </div>

        <p className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
          Parcel code is generated automatically after create.
        </p>

        <div className="grid gap-2">
          <Label htmlFor="merchantId">Merchant</Label>
          {merchantFieldReadOnly ? (
            <>
              <Input
                id="merchantId"
                value={selectedMerchant?.label ?? merchants[0]?.label ?? "-"}
                readOnly
                disabled
              />
              <input type="hidden" name="merchantId" value={defaultMerchantId} />
            </>
          ) : (
            <select
              key={state.fields?.merchantId ?? ""}
              id="merchantId"
              name="merchantId"
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              required
              defaultValue={state.fields?.merchantId ?? ""}
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
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="riderId">Rider (Optional)</Label>
          <select
            key={state.fields?.riderId ?? ""}
            id="riderId"
            name="riderId"
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            defaultValue={state.fields?.riderId ?? ""}
          >
            <option value="" disabled>
              Select rider
            </option>
            {riders.map((rider) => (
              <option key={rider.id} value={rider.id}>
                {rider.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="recipientName">Recipient Name</Label>
          <Input
            id="recipientName"
            name="recipientName"
            placeholder="Receiver full name"
            defaultValue={state.fields?.recipientName}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="recipientPhone">Recipient Phone</Label>
          <Input
            id="recipientPhone"
            name="recipientPhone"
            placeholder="09xxxxxxxxx"
            defaultValue={state.fields?.recipientPhone}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="recipientTownshipId">Recipient Township</Label>
          <select
            key={state.fields?.recipientTownshipId ?? ""}
            id="recipientTownshipId"
            name="recipientTownshipId"
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            required
            defaultValue={state.fields?.recipientTownshipId ?? ""}
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
        </div>

        <div className="grid gap-2">
          <Label htmlFor="recipientAddress">Recipient Address</Label>
          <textarea
            id="recipientAddress"
            name="recipientAddress"
            rows={3}
            defaultValue={state.fields?.recipientAddress}
            required
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Payment Record</h2>
          <p className="text-xs text-muted-foreground">
            Parcel and payment fields are submitted together in one transaction.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="parcelType">Parcel Type</Label>
          <select
            key={state.fields?.parcelType ?? ""}
            id="parcelType"
            name="parcelType"
            defaultValue={state.fields?.parcelType ?? ""}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            required
          >
            <option value="" disabled>
              Select parcel type
            </option>
            {PARCEL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="codAmount">COD Amount</Label>
          <Input
            id="codAmount"
            name="codAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={state.fields?.codAmount ?? 0}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="deliveryFee">Delivery Fee</Label>
          <Input
            id="deliveryFee"
            name="deliveryFee"
            type="number"
            min="0"
            step="0.01"
            defaultValue={state.fields?.deliveryFee ?? 0}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="deliveryFeePayer">Delivery Fee Payer</Label>
          <select
            key={state.fields?.deliveryFeePayer ?? DEFAULT_CREATE_PARCEL_STATE.deliveryFeePayer}
            id="deliveryFeePayer"
            name="deliveryFeePayer"
            defaultValue={
              state.fields?.deliveryFeePayer ?? DEFAULT_CREATE_PARCEL_STATE.deliveryFeePayer
            }
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            required
          >
            <option value="" disabled>
              Select delivery fee payer
            </option>
            {DELIVERY_FEE_PAYERS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="deliveryFeeStatus">Delivery Fee Status</Label>
          <select
            key={state.fields?.deliveryFeeStatus ?? DEFAULT_CREATE_PARCEL_STATE.deliveryFeeStatus}
            id="deliveryFeeStatus"
            name="deliveryFeeStatus"
            defaultValue={
              state.fields?.deliveryFeeStatus ?? DEFAULT_CREATE_PARCEL_STATE.deliveryFeeStatus
            }
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            required
          >
            <option value="" disabled>
              Select delivery fee status
            </option>
            {DELIVERY_FEE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 rounded-lg border bg-background p-3 text-xs">
          <p className="font-medium">Default states applied on create</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>Parcel Status: {DEFAULT_CREATE_PARCEL_STATE.parcelStatus}</li>
            <li>COD Status: {DEFAULT_CREATE_PARCEL_STATE.codStatus}</li>
            <li>Collection Status: {DEFAULT_CREATE_PARCEL_STATE.collectionStatus}</li>
            <li>
              Merchant Settlement Status: {DEFAULT_CREATE_PARCEL_STATE.merchantSettlementStatus}
            </li>
            <li>Rider Payout Status: {DEFAULT_CREATE_PARCEL_STATE.riderPayoutStatus}</li>
            <li>Delivery Fee Payer: selectable (default: receiver)</li>
            <li>Delivery Fee Status: selectable (default: unpaid)</li>
          </ul>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="paymentNote">Payment Note (Optional)</Label>
          <textarea
            id="paymentNote"
            name="paymentNote"
            rows={3}
            defaultValue={state.fields?.paymentNote}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </section>

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
        </div>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Parcel"}
      </Button>
    </form>
  );
}
