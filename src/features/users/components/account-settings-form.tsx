"use client";

import type { SubmitEvent } from "react";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FieldShell,
  FormBanner,
  inputClassName,
  textareaClassName,
  type FormMessageState,
} from "@/components/shared/form-fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateOwnPasswordAction } from "@/features/auth/server/actions";
import { updateOwnAccountAction } from "@/features/users/server/actions";
import type { UserListItemDto } from "@/features/users/server/dto";

export function AccountSettingsForm({
  user,
}: Readonly<{
  user: UserListItemDto;
}>) {
  const [isPending, startTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();
  const [name, setName] = useState(user.name);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber);
  const [address, setAddress] = useState(user.address);
  const [age, setAge] = useState(user.age ? String(user.age) : "");
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const [passwordState, setPasswordState] = useState<FormMessageState | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const nameId = useId();
  const phoneNumberId = useId();
  const addressId = useId();
  const ageId = useId();
  const currentPasswordId = useId();
  const newPasswordId = useId();

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionState(null);

    startTransition(async () => {
      const result = await updateOwnAccountAction({
        name,
        phoneNumber,
        address,
        age,
      });

      if (!result.ok) {
        setSubmissionState({
          kind: "error",
          message: result.message,
        });
        return;
      }

      setSubmissionState({
        kind: "success",
        message: "Account details are ready to save.",
        detail: "This mock flow validates your account changes without persistence yet.",
      });
    });
  }

  function handlePasswordSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordState(null);

    startPasswordTransition(async () => {
      const result = await updateOwnPasswordAction({
        currentPassword,
        newPassword,
      });

      if (!result.ok) {
        setPasswordState({
          kind: "error",
          message: result.message,
        });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setPasswordState({
        kind: "success",
        message: "Password change is ready to save.",
        detail: "This mock flow validates the password change without persistence yet.",
      });
    });
  }

  return (
    <div className="grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Update your personal account details. Role, active status, and bank accounts remain
            managed outside this form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {submissionState ? <FormBanner state={submissionState} /> : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldShell htmlFor={nameId} label="Name">
                <Input
                  id={nameId}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setSubmissionState(null);
                  }}
                  placeholder="Enter full name"
                  className={inputClassName}
                  disabled={isPending}
                />
              </FieldShell>

              <FieldShell htmlFor={phoneNumberId} label="Phone number">
                <Input
                  id={phoneNumberId}
                  value={phoneNumber}
                  onChange={(event) => {
                    setPhoneNumber(event.target.value);
                    setSubmissionState(null);
                  }}
                  placeholder="09xxxxxxxxx"
                  className={inputClassName}
                  disabled={isPending}
                />
              </FieldShell>
            </div>

            <FieldShell htmlFor={addressId} label="Address">
              <Textarea
                id={addressId}
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setSubmissionState(null);
                }}
                placeholder="Street, ward, township, landmark"
                className={textareaClassName}
                disabled={isPending}
              />
            </FieldShell>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldShell htmlFor={ageId} label="Age (optional)">
                <Input
                  id={ageId}
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={age}
                  onChange={(event) => {
                    setAge(event.target.value);
                    setSubmissionState(null);
                  }}
                  placeholder="Optional"
                  className={inputClassName}
                  disabled={isPending}
                />
              </FieldShell>

              {user.shopName ? (
                <FieldShell htmlFor="shop-readonly" label="Shop">
                  <Input
                    id="shop-readonly"
                    value={user.shopName}
                    readOnly
                    className={inputClassName}
                    disabled
                  />
                </FieldShell>
              ) : user.serviceTownshipName ? (
                <FieldShell htmlFor="township-readonly" label="Service township">
                  <Input
                    id="township-readonly"
                    value={user.serviceTownshipName}
                    readOnly
                    className={inputClassName}
                    disabled
                  />
                </FieldShell>
              ) : (
                <div />
              )}
            </div>

            <CardFooter className="justify-end border-t px-0 pt-5">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Change your password using your current password and a new password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {passwordState ? <FormBanner state={passwordState} /> : null}

          <form className="space-y-5" onSubmit={handlePasswordSubmit}>
            <FieldShell htmlFor={currentPasswordId} label="Current password">
              <Input
                id={currentPasswordId}
                type="password"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  setPasswordState(null);
                }}
                placeholder="Enter current password"
                className={inputClassName}
                disabled={isPasswordPending}
              />
            </FieldShell>

            <FieldShell htmlFor={newPasswordId} label="New password">
              <Input
                id={newPasswordId}
                type="password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setPasswordState(null);
                }}
                placeholder="Enter new password"
                className={inputClassName}
                disabled={isPasswordPending}
              />
            </FieldShell>

            <CardFooter className="justify-end border-t px-0 pt-5">
              <Button type="submit" disabled={isPasswordPending}>
                {isPasswordPending ? "Updating..." : "Update Password"}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
