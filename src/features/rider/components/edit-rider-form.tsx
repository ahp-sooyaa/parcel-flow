"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateRiderProfileAction } from "@/features/rider/server/actions";

type EditRiderFormProps = {
  riderId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  townshipId: string | null;
  vehicleType: string;
  licensePlate: string | null;
  isActive: boolean;
  notes: string | null;
  townships: {
    id: string;
    name: string;
  }[];
  canEditOperationalStatus: boolean;
};

const initialState = {
  ok: true,
  message: "",
};

export function EditRiderForm({
  riderId,
  fullName,
  email,
  phoneNumber,
  townshipId,
  vehicleType,
  licensePlate,
  isActive,
  notes,
  townships,
  canEditOperationalStatus,
}: Readonly<EditRiderFormProps>) {
  const [state, action, isPending] = useActionState(updateRiderProfileAction, initialState);
  const [values, setValues] = useState({
    townshipId: townshipId ?? "",
    vehicleType,
    licensePlate: licensePlate ?? "",
    notes: notes ?? "",
  });

  useEffect(() => {
    setValues({
      townshipId: townshipId ?? "",
      vehicleType,
      licensePlate: licensePlate ?? "",
      notes: notes ?? "",
    });
  }, [townshipId, vehicleType, licensePlate, notes]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="riderId" value={riderId} />

      <div className="grid gap-2">
        <Label htmlFor="rider-full-name">Rider Name</Label>
        <Input id="rider-full-name" value={fullName} disabled />
      </div>

      <div className="grid gap-2 md:grid-cols-2 md:gap-4">
        <div className="grid gap-2">
          <Label htmlFor="rider-email">Email</Label>
          <Input id="rider-email" value={email} disabled />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="rider-phone">Phone Number</Label>
          <Input id="rider-phone" value={phoneNumber ?? "-"} disabled />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rider-township">Township</Label>
        <select
          id="rider-township"
          name="townshipId"
          className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={values.townshipId}
          onChange={(event) => {
            setValues((prev) => ({
              ...prev,
              townshipId: event.target.value,
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
        <Label htmlFor="rider-vehicle-type">Vehicle Type</Label>
        <Input
          id="rider-vehicle-type"
          name="vehicleType"
          value={values.vehicleType}
          onChange={(event) => {
            setValues((prev) => ({
              ...prev,
              vehicleType: event.target.value,
            }));
          }}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rider-license-plate">License Plate</Label>
        <Input
          id="rider-license-plate"
          name="licensePlate"
          value={values.licensePlate}
          onChange={(event) => {
            setValues((prev) => ({
              ...prev,
              licensePlate: event.target.value,
            }));
          }}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rider-notes">Notes</Label>
        <textarea
          id="rider-notes"
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

      {canEditOperationalStatus ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={isActive} className="h-4 w-4" />{" "}
          Rider is operationally active
        </label>
      ) : null}

      {state.message ? (
        <p className={state.ok ? "text-xs text-emerald-700" : "text-xs text-destructive"}>
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Rider Profile"}
      </Button>
    </form>
  );
}
