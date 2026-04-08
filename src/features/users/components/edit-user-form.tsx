"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUserProfileAction } from "@/features/users/server/actions";
import { cn } from "@/lib/utils";

type EditUserFormProps = {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  roleLabel: string;
};

const initialState = {
  ok: true,
  message: "",
};

export function EditUserForm({
  userId,
  fullName,
  email,
  phoneNumber,
  roleLabel,
}: Readonly<EditUserFormProps>) {
  const [state, action, isPending] = useActionState(updateUserProfileAction, initialState);
  const [values, setValues] = useState({
    fullName,
    phoneNumber: phoneNumber ?? "",
  });

  useEffect(() => {
    setValues({
      fullName,
      phoneNumber: phoneNumber ?? "",
    });
  }, [fullName, phoneNumber]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="userId" value={userId} />

      <div className="grid gap-2">
        <Label htmlFor="edit-user-full-name">Full Name</Label>
        <Input
          id="edit-user-full-name"
          name="fullName"
          value={values.fullName}
          onChange={(event) => {
            setValues((prev) => ({
              ...prev,
              fullName: event.target.value,
            }));
          }}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="edit-user-email">Email</Label>
        <Input id="edit-user-email" value={email} disabled />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="edit-user-role">Role</Label>
        <Input id="edit-user-role" value={roleLabel} disabled />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="edit-user-phone-number">Phone Number</Label>
        <Input
          id="edit-user-phone-number"
          name="phoneNumber"
          value={values.phoneNumber}
          onChange={(event) => {
            setValues((prev) => ({
              ...prev,
              phoneNumber: event.target.value,
            }));
          }}
        />
      </div>

      {state.message && (
        <p
          className={cn("text-xs", {
            "text-emerald-700": state.ok,
            "text-destructive": !state.ok,
          })}
        >
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save User Profile"}
      </Button>
    </form>
  );
}
