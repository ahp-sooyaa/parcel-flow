"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAccountProfileAction } from "@/features/users/server/actions";
import { formatRoleSlug } from "@/lib/roles";
import { cn } from "@/lib/utils";

import type { RoleSlug } from "@/db/constants";

type AccountEditFormProps = {
  user: {
    appUserId: string;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    roleSlug?: RoleSlug;
  };
  mode: "self" | "admin";
  submitLabel?: string;
};

const initialState = {
  ok: true,
  message: "",
};

export function AccountEditForm({
  user,
  mode,
  submitLabel = "Save Profile",
}: Readonly<AccountEditFormProps>) {
  const [state, action, isPending] = useActionState(updateAccountProfileAction, initialState);
  const [values, setValues] = useState({
    fullName: user.fullName,
    phoneNumber: user.phoneNumber ?? "",
  });

  useEffect(() => {
    setValues({
      fullName: user.fullName,
      phoneNumber: user.phoneNumber ?? "",
    });
  }, [user.fullName, user.phoneNumber]);

  return (
    <form action={action} className="space-y-5">
      {mode === "admin" && <input type="hidden" name="targetUserId" value={user.appUserId} />}

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
        <Input id="edit-user-email" value={user.email} disabled />
      </div>

      {mode === "admin" && (
        <div className="grid gap-2">
          <Label htmlFor="edit-user-role">Role</Label>
          <Input
            id="edit-user-role"
            value={user.roleSlug ? formatRoleSlug(user.roleSlug) : "-"}
            disabled
          />
        </div>
      )}

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
        {isPending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
