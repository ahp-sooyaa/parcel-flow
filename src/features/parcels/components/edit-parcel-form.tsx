"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  COD_STATUSES,
  COLLECTION_STATUSES,
  DELIVERY_FEE_PAYERS,
  DELIVERY_FEE_STATUSES,
  MERCHANT_SETTLEMENT_STATUSES,
  PARCEL_STATUSES,
  PARCEL_TYPES,
  RIDER_PAYOUT_STATUSES,
} from "@/features/parcels/constants";
import { updateParcelAction } from "@/features/parcels/server/actions";
import { cn } from "@/lib/utils";

type EditParcelFormProps = {
  parcel: {
    id: string;
    parcelCode: string;
    merchantId: string;
    riderId: string | null;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
    parcelType: (typeof PARCEL_TYPES)[number];
    codAmount: string;
    deliveryFee: string;
    deliveryFeePayer: (typeof DELIVERY_FEE_PAYERS)[number];
    parcelStatus: (typeof PARCEL_STATUSES)[number];
    deliveryFeeStatus: (typeof DELIVERY_FEE_STATUSES)[number];
    codStatus: (typeof COD_STATUSES)[number];
    collectedAmount: string;
    collectionStatus: (typeof COLLECTION_STATUSES)[number];
    merchantSettlementStatus: (typeof MERCHANT_SETTLEMENT_STATUSES)[number];
    riderPayoutStatus: (typeof RIDER_PAYOUT_STATUSES)[number];
    paymentNote: string | null;
  };
  merchants: { id: string; label: string }[];
  riders: { id: string; label: string }[];
  townships: { id: string; label: string }[];
  merchantFieldReadOnly?: boolean;
  accountingFieldsReadOnly?: boolean;
};

type FormValues = {
  merchantId: string;
  riderId: string;
  recipientName: string;
  recipientPhone: string;
  recipientTownshipId: string;
  recipientAddress: string;
  parcelType: string;
  codAmount: string;
  deliveryFee: string;
  deliveryFeePayer: string;
  parcelStatus: string;
  deliveryFeeStatus: string;
  codStatus: string;
  collectedAmount: string;
  collectionStatus: string;
  merchantSettlementStatus: string;
  riderPayoutStatus: string;
  paymentNote: string;
};

const initialState = {
  ok: true,
  message: "",
  fields: undefined,
};

function buildFormValues(parcel: EditParcelFormProps["parcel"]): FormValues {
  return {
    merchantId: parcel.merchantId,
    riderId: parcel.riderId ?? "",
    recipientName: parcel.recipientName,
    recipientPhone: parcel.recipientPhone,
    recipientTownshipId: parcel.recipientTownshipId,
    recipientAddress: parcel.recipientAddress,
    parcelType: parcel.parcelType,
    codAmount: parcel.codAmount,
    deliveryFee: parcel.deliveryFee,
    deliveryFeePayer: parcel.deliveryFeePayer,
    parcelStatus: parcel.parcelStatus,
    deliveryFeeStatus: parcel.deliveryFeeStatus,
    codStatus: parcel.codStatus,
    collectedAmount: parcel.collectedAmount,
    collectionStatus: parcel.collectionStatus,
    merchantSettlementStatus: parcel.merchantSettlementStatus,
    riderPayoutStatus: parcel.riderPayoutStatus,
    paymentNote: parcel.paymentNote ?? "",
  };
}

export function EditParcelForm({
  parcel,
  merchants,
  riders,
  townships,
  merchantFieldReadOnly = false,
  accountingFieldsReadOnly = false,
}: Readonly<EditParcelFormProps>) {
  const [state, action, isPending] = useActionState(updateParcelAction, initialState);

  const fields = state.fields ?? buildFormValues(parcel);
  const selectedMerchant = merchants.find((merchant) => merchant.id === fields.merchantId);
  const selectedRider = riders.find((rider) => rider.id === fields.riderId);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="parcelId" value={parcel.id} />

      <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Parcel Info</h2>
          <p className="text-xs text-muted-foreground">Update parcel-level operational fields.</p>
        </div>

        <div className="grid gap-1 rounded-lg border bg-background p-3 text-xs">
          <p className="text-muted-foreground">Parcel Code</p>
          <p className="font-mono">{parcel.parcelCode}</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="merchant-id">Merchant</Label>
          {merchantFieldReadOnly ? (
            <>
              <Input id="merchant-id" value={selectedMerchant?.label ?? "-"} readOnly disabled />
              <input type="hidden" name="merchantId" value={fields.merchantId} />
            </>
          ) : (
            <select
              key={fields.merchantId}
              id="merchant-id"
              name="merchantId"
              defaultValue={fields.merchantId}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              required
            >
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  {merchant.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="rider-id">Rider (Optional)</Label>
          {accountingFieldsReadOnly ? (
            <>
              <Input
                id="rider-id"
                value={selectedRider?.label ?? "No rider assigned"}
                readOnly
                disabled
              />
              <input type="hidden" name="riderId" value={fields.riderId} />
            </>
          ) : (
            <select
              key={fields.riderId}
              id="rider-id"
              name="riderId"
              defaultValue={fields.riderId}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">No rider assigned</option>
              {riders.map((rider) => (
                <option key={rider.id} value={rider.id}>
                  {rider.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="recipient-name">Recipient Name</Label>
          <Input
            id="recipient-name"
            name="recipientName"
            defaultValue={fields.recipientName}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="recipient-phone">Recipient Phone</Label>
          <Input
            id="recipient-phone"
            name="recipientPhone"
            defaultValue={fields.recipientPhone}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="recipient-township-id">Recipient Township</Label>
          <select
            key={fields.recipientTownshipId}
            id="recipient-township-id"
            name="recipientTownshipId"
            defaultValue={fields.recipientTownshipId}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            required
          >
            {townships.map((township) => (
              <option key={township.id} value={township.id}>
                {township.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="recipient-address">Recipient Address</Label>
          <textarea
            id="recipient-address"
            name="recipientAddress"
            rows={3}
            defaultValue={fields.recipientAddress}
            required
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="parcel-status">Parcel Status</Label>
          {accountingFieldsReadOnly ? (
            <>
              <Input id="parcel-status" value={fields.parcelStatus} readOnly disabled />
              <input type="hidden" name="parcelStatus" value={fields.parcelStatus} />
            </>
          ) : (
            <select
              key={fields.parcelStatus}
              id="parcel-status"
              name="parcelStatus"
              defaultValue={fields.parcelStatus}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              required
            >
              {PARCEL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Payment Record</h2>
          <p className="text-xs text-muted-foreground">
            Update parcel-linked payment statuses and collection amounts.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="parcel-type">Parcel Type</Label>
          <select
            key={fields.parcelType}
            id="parcel-type"
            name="parcelType"
            defaultValue={fields.parcelType}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            required
          >
            {PARCEL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="cod-amount">COD Amount</Label>
          <Input
            id="cod-amount"
            name="codAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={fields.codAmount}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="delivery-fee">Delivery Fee</Label>
          <Input
            id="delivery-fee"
            name="deliveryFee"
            type="number"
            min="0"
            step="0.01"
            defaultValue={fields.deliveryFee}
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="delivery-fee-payer">Delivery Fee Payer</Label>
          <select
            key={fields.deliveryFeePayer}
            id="delivery-fee-payer"
            name="deliveryFeePayer"
            defaultValue={fields.deliveryFeePayer}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            required
          >
            {DELIVERY_FEE_PAYERS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        {accountingFieldsReadOnly ? (
          <>
            <p className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
              Internal accounting and settlement fields stay managed by office users.
            </p>
            <input type="hidden" name="deliveryFeeStatus" value={fields.deliveryFeeStatus} />
            <input type="hidden" name="codStatus" value={fields.codStatus} />
            <input type="hidden" name="collectedAmount" value={fields.collectedAmount} />
            <input type="hidden" name="collectionStatus" value={fields.collectionStatus} />
            <input
              type="hidden"
              name="merchantSettlementStatus"
              value={fields.merchantSettlementStatus}
            />
            <input type="hidden" name="riderPayoutStatus" value={fields.riderPayoutStatus} />
            <input type="hidden" name="paymentNote" value={fields.paymentNote} />
          </>
        ) : (
          <>
            <div className="grid gap-2">
              <Label htmlFor="delivery-fee-status">Delivery Fee Status</Label>
              <select
                key={fields.deliveryFeeStatus}
                id="delivery-fee-status"
                name="deliveryFeeStatus"
                defaultValue={fields.deliveryFeeStatus}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                required
              >
                {DELIVERY_FEE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cod-status">COD Status</Label>
              <select
                key={fields.codStatus}
                id="cod-status"
                name="codStatus"
                defaultValue={fields.codStatus}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                required
              >
                {COD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="collected-amount">Collected Amount</Label>
              <Input
                id="collected-amount"
                name="collectedAmount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={fields.collectedAmount}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="collection-status">Collection Status</Label>
              <select
                key={fields.collectionStatus}
                id="collection-status"
                name="collectionStatus"
                defaultValue={fields.collectionStatus}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                required
              >
                {COLLECTION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="merchant-settlement-status">Merchant Settlement Status</Label>
              <select
                key={fields.merchantSettlementStatus}
                id="merchant-settlement-status"
                name="merchantSettlementStatus"
                defaultValue={fields.merchantSettlementStatus}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                required
              >
                {MERCHANT_SETTLEMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rider-payout-status">Rider Payout Status</Label>
              <select
                key={fields.riderPayoutStatus}
                id="rider-payout-status"
                name="riderPayoutStatus"
                defaultValue={fields.riderPayoutStatus}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                required
              >
                {RIDER_PAYOUT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="payment-note">Payment Note (Optional)</Label>
              <textarea
                id="payment-note"
                name="paymentNote"
                rows={3}
                defaultValue={fields.paymentNote}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </>
        )}
      </section>

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
        </div>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Parcel"}
      </Button>
    </form>
  );
}
