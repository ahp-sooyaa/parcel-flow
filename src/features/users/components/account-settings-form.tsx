"use client";

import { useActionState, useId } from "react";

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
} from "@/components/shared/form-fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateOwnPasswordFormAction,
  type PasswordSettingsFormState,
} from "@/features/auth/server/actions";
import {
  updateOwnAccountFormAction,
  type AccountSettingsFormState,
} from "@/features/users/server/actions";
import type { UserListItemDto } from "@/features/users/server/dto";

export function AccountSettingsForm({ user }: Readonly<{ user: UserListItemDto }>) {
  const nameId = useId();
  const phoneNumberId = useId();
  const addressId = useId();
  const ageId = useId();
  const currentPasswordId = useId();
  const newPasswordId = useId();

  const initialAccountState: AccountSettingsFormState = {
    ok: false,
    message: null,
    values: {
      name: user.name,
      phoneNumber: user.phoneNumber,
      address: user.address,
      age: user.age ? String(user.age) : "",
    },
  };
  const initialPasswordState: PasswordSettingsFormState = {
    ok: false,
    message: null,
  };
  const [accountState, accountFormAction, isAccountPending] = useActionState(
    updateOwnAccountFormAction,
    initialAccountState,
  );
  const [passwordState, passwordFormAction, isPasswordPending] = useActionState(
    updateOwnPasswordFormAction,
    initialPasswordState,
  );

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
          {accountState.message ? (
            <FormBanner
              state={{
                kind: accountState.ok ? "success" : "error",
                message: accountState.message,
                detail: accountState.ok
                  ? "Your persisted account details will be reflected after refresh."
                  : undefined,
              }}
            />
          ) : null}

          <form action={accountFormAction} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldShell htmlFor={nameId} label="Name">
                <Input
                  id={nameId}
                  name="name"
                  defaultValue={accountState.values.name}
                  placeholder="Enter full name"
                  className={inputClassName}
                  disabled={isAccountPending}
                />
              </FieldShell>

              <FieldShell htmlFor={phoneNumberId} label="Phone number">
                <Input
                  id={phoneNumberId}
                  name="phoneNumber"
                  defaultValue={accountState.values.phoneNumber}
                  placeholder="09xxxxxxxxx"
                  className={inputClassName}
                  disabled={isAccountPending}
                />
              </FieldShell>
            </div>

            <FieldShell htmlFor={addressId} label="Address">
              <Textarea
                id={addressId}
                name="address"
                defaultValue={accountState.values.address}
                placeholder="Street, ward, township, landmark"
                className={textareaClassName}
                disabled={isAccountPending}
              />
            </FieldShell>

            <div className="grid gap-4 sm:grid-cols-2">
              <FieldShell htmlFor={ageId} label="Age (optional)">
                <Input
                  id={ageId}
                  name="age"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  defaultValue={accountState.values.age}
                  placeholder="Optional"
                  className={inputClassName}
                  disabled={isAccountPending}
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
              <Button type="submit" disabled={isAccountPending}>
                {isAccountPending ? "Saving..." : "Save Changes"}
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
          {passwordState.message ? (
            <FormBanner
              state={{
                kind: passwordState.ok ? "success" : "error",
                message: passwordState.message,
                detail: passwordState.ok
                  ? "Use the new password the next time you sign in."
                  : undefined,
              }}
            />
          ) : null}

          <form action={passwordFormAction} className="space-y-5">
            <FieldShell htmlFor={currentPasswordId} label="Current password">
              <Input
                id={currentPasswordId}
                name="currentPassword"
                type="password"
                placeholder="Enter current password"
                className={inputClassName}
                disabled={isPasswordPending}
              />
            </FieldShell>

            <FieldShell htmlFor={newPasswordId} label="New password">
              <Input
                id={newPasswordId}
                name="newPassword"
                type="password"
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
