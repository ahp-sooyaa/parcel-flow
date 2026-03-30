"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPasswordAction, updateOwnProfileAction } from "@/features/profile/server/actions";

type ProfileFormsProps = {
  fullName: string;
  email: string;
  phoneNumber: string | null;
};

const profileInitial = { ok: true, message: "" };

export function ProfileForms({ fullName, email, phoneNumber }: ProfileFormsProps) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateOwnProfileAction,
    profileInitial,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changeOwnPasswordAction,
    profileInitial,
  );
  const [profileValues, setProfileValues] = useState({
    fullName,
    phoneNumber: phoneNumber ?? "",
  });

  useEffect(() => {
    setProfileValues({
      fullName,
      phoneNumber: phoneNumber ?? "",
    });
  }, [fullName, phoneNumber]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <header>
          <h2 className="text-lg font-semibold">Account Profile</h2>
          <p className="text-xs text-muted-foreground">Update your own profile contact details.</p>
        </header>

        <form action={profileAction} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-full-name">Full Name</Label>
            <Input
              id="profile-full-name"
              name="fullName"
              value={profileValues.fullName}
              onChange={(event) => {
                setProfileValues((prev) => ({
                  ...prev,
                  fullName: event.target.value,
                }));
              }}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={email} disabled />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-phone-number">Phone Number</Label>
            <Input
              id="profile-phone-number"
              name="phoneNumber"
              value={profileValues.phoneNumber}
              onChange={(event) => {
                setProfileValues((prev) => ({
                  ...prev,
                  phoneNumber: event.target.value,
                }));
              }}
            />
          </div>

          {profileState.message ? (
            <p
              className={profileState.ok ? "text-xs text-emerald-700" : "text-xs text-destructive"}
            >
              {profileState.message}
            </p>
          ) : null}

          <Button type="submit" disabled={profilePending}>
            {profilePending ? "Saving..." : "Save Profile"}
          </Button>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <header>
          <h2 className="text-lg font-semibold">Security</h2>
          <p className="text-xs text-muted-foreground">Change your own password.</p>
        </header>

        <form action={passwordAction} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input id="new-password" name="password" type="password" required minLength={12} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              required
              minLength={12}
            />
          </div>

          {passwordState.message ? (
            <p
              className={passwordState.ok ? "text-xs text-emerald-700" : "text-xs text-destructive"}
            >
              {passwordState.message}
            </p>
          ) : null}

          <Button type="submit" disabled={passwordPending}>
            {passwordPending ? "Updating..." : "Change Password"}
          </Button>
        </form>
      </section>
    </div>
  );
}
