"use client";

import type { SubmitEvent } from "react";
import { useId, useRef, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FieldShell,
  FormBanner,
  groupedInputClassName,
  inputClassName,
  textareaClassName,
  type FormMessageState,
} from "@/components/shared/form-fields";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetClose, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { regeneratePasswordAction } from "@/features/auth/server/actions";
import {
  buildTownshipOptions,
  findTownshipOption,
  type TownshipOption,
  UserRoleSelectField,
} from "@/features/users/components/user-form-support";
import { updateUserAction } from "@/features/users/server/actions";
import type { UserListItemDto } from "@/features/users/server/dto";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { userRoles, type UserRole } from "@/lib/domain";

export function EditUserForm({
  user,
  townships,
}: Readonly<{
  user: UserListItemDto;
  townships: TownshipListItemDto[];
}>) {
  const overlayContainerRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isPasswordResetPending, startPasswordResetTransition] = useTransition();

  const nameId = useId();
  const phoneNumberId = useId();
  const addressId = useId();
  const ageId = useId();
  const roleId = useId();
  const shopId = useId();
  const serviceTownshipId = useId();

  const townshipOptions = buildTownshipOptions(townships);
  const initialTownship = findTownshipOption(
    townshipOptions,
    user.serviceTownshipId,
    user.serviceTownshipName,
  );

  const [name, setName] = useState(user.name);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber);
  const [address, setAddress] = useState(user.address);
  const [age, setAge] = useState(user.age ? String(user.age) : "");
  const [isActive, setIsActive] = useState(user.isActive);
  const [role, setRole] = useState<UserRole>(user.role);
  const [shopName, setShopName] = useState(user.shopName ?? "");
  const [selectedTownship, setSelectedTownship] = useState(initialTownship);
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const isBusy = isPending || isPasswordResetPending;

  function handlePasswordReset() {
    setSubmissionState(null);

    startPasswordResetTransition(async () => {
      try {
        const result = await regeneratePasswordAction(user.role);

        setSubmissionState({
          kind: "success",
          message: "Temporary password generated.",
          detail: `Share this password with the user: ${result.temporaryPassword}`,
        });
      } catch (error) {
        setSubmissionState({
          kind: "error",
          message:
            error instanceof Error ? error.message : "Unable to regenerate password right now.",
        });
      }
    });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionState(null);

    startTransition(async () => {
      const result = await updateUserAction({
        id: user.id,
        currentRole: user.role,
        name,
        phoneNumber,
        address,
        age,
        isActive,
        role,
        shopName: role === "merchant" ? shopName : undefined,
        serviceTownshipId: role === "rider" ? selectedTownship?.value : undefined,
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
        message: `${name} is ready to save.`,
        detail: "This mock flow validates the edited profile details without persistence yet.",
      });
    });
  }

  return (
    <form
      ref={overlayContainerRef}
      className="flex h-full flex-col bg-[#fcfbf8] text-[#292827]"
      onSubmit={handleSubmit}
    >
      <SheetHeader className="space-y-3 border-b border-[#e7dfd8] p-6 pb-4 text-left">
        <SheetTitle className="text-[2rem] font-semibold tracking-[-0.04em]">Edit User</SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        <Tabs defaultValue="account">
          <TabsList className="rounded-lg border border-border bg-[#f3f2ef] p-1">
            <TabsTrigger
              value="account"
              className="rounded-md border-0 px-4 text-sm data-active:bg-white"
            >
              Account Details
            </TabsTrigger>
            <TabsTrigger
              value="bank"
              className="rounded-md border-0 px-4 text-sm data-active:bg-white"
            >
              Bank Accounts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-5">
            {submissionState ? <FormBanner state={submissionState} /> : null}

            <Card className="border-[#e7dfd8] bg-white shadow-[0_20px_50px_rgba(27,25,56,0.06)]">
              <CardContent className="space-y-5">
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
                      disabled={isBusy}
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
                      disabled={isBusy}
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
                    disabled={isBusy}
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
                      disabled={isBusy}
                    />
                  </FieldShell>

                  <FieldShell htmlFor={roleId} label="Role">
                    <UserRoleSelectField
                      id={roleId}
                      value={role}
                      onChange={(nextRole) => {
                        setRole(nextRole);
                        setSubmissionState(null);

                        if (nextRole !== "merchant") {
                          setShopName("");
                        }

                        if (nextRole !== "rider") {
                          setSelectedTownship(null);
                        }
                      }}
                      disabled={isBusy}
                      roles={userRoles}
                    />
                  </FieldShell>
                </div>

                <div className="grid gap-4 rounded-lg border border-dashed border-[#dcd4cd] bg-[#fcfbf8] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="space-y-1">
                    <Label
                      htmlFor="user-active-switch"
                      className="text-sm font-medium text-[#292827]"
                    >
                      Active
                    </Label>
                    <p className="text-sm text-[#5f5b58]">
                      Turn this off to prevent the user from accessing the app.
                    </p>
                  </div>
                  <Switch
                    id="user-active-switch"
                    checked={isActive}
                    onCheckedChange={(checked) => {
                      setIsActive(checked);
                      setSubmissionState(null);
                    }}
                    disabled={isBusy}
                  />
                </div>

                {role === "merchant" ? (
                  <FieldShell htmlFor={shopId} label="Shop">
                    <Input
                      id={shopId}
                      value={shopName}
                      onChange={(event) => {
                        setShopName(event.target.value);
                        setSubmissionState(null);
                      }}
                      placeholder="Enter shop name"
                      className={inputClassName}
                      disabled={isBusy}
                    />
                  </FieldShell>
                ) : null}

                {role === "rider" ? (
                  <FieldShell htmlFor={serviceTownshipId} label="Service township">
                    <Combobox
                      items={townshipOptions}
                      value={selectedTownship}
                      onValueChange={(township = null) => {
                        setSelectedTownship(township);
                        setSubmissionState(null);
                      }}
                      itemToStringLabel={(option) => option.label}
                      isItemEqualToValue={(item, value) => item.value === value.value}
                    >
                      <ComboboxInput
                        id={serviceTownshipId}
                        aria-label="Select rider service township"
                        placeholder="Search township"
                        showClear={selectedTownship !== null}
                        className={groupedInputClassName}
                        disabled={isBusy}
                      />
                      <ComboboxContent className="z-50" portalContainer={overlayContainerRef}>
                        <ComboboxEmpty>No townships found.</ComboboxEmpty>
                        <ComboboxCollection>
                          {(option: TownshipOption) => (
                            <ComboboxItem key={option.value} value={option} className="py-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-[#292827]">{option.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {option.helper}
                                </span>
                              </div>
                            </ComboboxItem>
                          )}
                        </ComboboxCollection>
                      </ComboboxContent>
                    </Combobox>
                  </FieldShell>
                ) : null}

                <div className="flex flex-col gap-3 rounded-lg border border-dashed border-[#dcd4cd] bg-[#fcfbf8] p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#292827]">Forgot password</p>
                    <p className="text-sm text-[#5f5b58]">
                      Generate a temporary password and require the user to reset it after login.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    onClick={handlePasswordReset}
                  >
                    <RefreshCw
                      className={isPasswordResetPending ? "size-4 animate-spin" : "size-4"}
                    />
                    {isPasswordResetPending ? "Generating..." : "Regenerate Password"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TODO: wire bank account editing. reference settings page bank account. */}
          <TabsContent value="bank">
            <Card className="border-[#e7dfd8] bg-white shadow-[0_20px_50px_rgba(27,25,56,0.06)]">
              <CardContent className="space-y-3 text-sm text-[#5f5b58]">
                <p className="font-medium text-[#292827]">Bank account editing is not wired yet.</p>
                <p>
                  This tab is reserved for the spec-required bank account section on the user edit
                  sheet.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <SheetFooter className="mt-0 justify-end border-t border-[#e7dfd8] bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <SheetClose asChild>
            <Button type="button" variant="outline" disabled={isBusy}>
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="submit"
            className="bg-[#1b1938] text-white hover:bg-[#0e0c1f]"
            disabled={isBusy}
          >
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </SheetFooter>
    </form>
  );
}
