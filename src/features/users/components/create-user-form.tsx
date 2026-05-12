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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import {
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { createUserAction } from "@/features/users/server/actions";
import {
  buildTownshipOptions,
  generateTemporaryPassword,
  type TownshipOption,
  UserRoleSelectField,
} from "@/features/users/components/user-form-support";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { creatableUserRoles, roleLabels, type CreatableUserRole } from "@/lib/domain";

type CreateUserFormProps = Readonly<{
  townships: TownshipListItemDto[];
}>;

export function CreateUserForm({ townships }: CreateUserFormProps) {
  const overlayContainerRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  const nameId = useId();
  const phoneNumberId = useId();
  const addressId = useId();
  const ageId = useId();
  const roleId = useId();
  const passwordId = useId();
  const shopId = useId();
  const serviceTownshipId = useId();

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [age, setAge] = useState("");
  const [role, setRole] = useState<CreatableUserRole>("office_admin");
  const [password, setPassword] = useState(() => generateTemporaryPassword());
  const [shopName, setShopName] = useState("");
  const [selectedTownship, setSelectedTownship] = useState<TownshipOption | null>(null);
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);

  const townshipOptions = buildTownshipOptions(townships);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionState(null);

    startTransition(async () => {
      const result = await createUserAction({
        name,
        phoneNumber,
        address,
        age,
        isActive: true,
        role,
        password,
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
        message: `${roleLabels[role]} account is ready to hand off.`,
        detail: `Password to share: ${result.temporaryPassword}`,
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
        <SheetTitle className="text-[2rem] font-semibold tracking-[-0.04em]">
          Create User
        </SheetTitle>
        <SheetDescription className="max-w-md text-sm leading-6 text-[#73706d]">
          Create office admin, merchant, or rider accounts with a generated password and
          role-specific profile details.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        <div className="space-y-5">
          {submissionState ? <FormBanner state={submissionState} /> : null}

          <Card className="border-[#e7dfd8] bg-white shadow-[0_20px_50px_rgba(27,25,56,0.06)]">
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell htmlFor={nameId} label="Name">
                  <Input
                    id={nameId}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter full name"
                    className={inputClassName}
                    disabled={isPending}
                  />
                </FieldShell>

                <FieldShell htmlFor={phoneNumberId} label="Phone number">
                  <Input
                    id={phoneNumberId}
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
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
                  onChange={(event) => setAddress(event.target.value)}
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
                    onChange={(event) => setAge(event.target.value)}
                    placeholder="Optional"
                    className={inputClassName}
                    disabled={isPending}
                  />
                </FieldShell>

                <FieldShell htmlFor={roleId} label="Role">
                  <UserRoleSelectField
                    id={roleId}
                    value={role}
                    onChange={(nextRole) => {
                      setRole(nextRole);
                      setSubmissionState(null);
                    }}
                    disabled={isPending}
                    roles={creatableUserRoles}
                  />
                </FieldShell>
              </div>

              <FieldShell htmlFor={passwordId} label="Generated password">
                <InputGroup className={groupedInputClassName}>
                  <InputGroupInput
                    id={passwordId}
                    value={password}
                    readOnly
                    className="h-full px-2 text-sm text-[#292827]"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      variant="ghost"
                      size="xs"
                      disabled={isPending}
                      onClick={() => {
                        setPassword(generateTemporaryPassword());
                        setSubmissionState(null);
                      }}
                    >
                      <RefreshCw className="size-3.5" />
                      Regenerate
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <p className="mt-1 text-xs text-[#73706d]">
                  Share this password with the user outside the system.
                </p>
              </FieldShell>

              {role === "merchant" ? (
                <FieldShell htmlFor={shopId} label="Shop">
                  <Input
                    id={shopId}
                    value={shopName}
                    onChange={(event) => setShopName(event.target.value)}
                    placeholder="Enter shop name"
                    className={inputClassName}
                    disabled={isPending}
                  />
                </FieldShell>
              ) : null}

              {role === "rider" ? (
                <FieldShell htmlFor={serviceTownshipId} label="Service township">
                  <Combobox
                    items={townshipOptions}
                    value={selectedTownship}
                    onValueChange={(nextValue) => {
                      setSelectedTownship(nextValue ?? null);
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
                      disabled={isPending}
                    />
                    <ComboboxContent className="z-50" portalContainer={overlayContainerRef}>
                      <ComboboxEmpty>No townships found.</ComboboxEmpty>
                      <ComboboxCollection>
                        {(option: TownshipOption) => (
                          <ComboboxItem key={option.value} value={option} className="py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-[#292827]">{option.label}</span>
                              <span className="text-xs text-muted-foreground">{option.helper}</span>
                            </div>
                          </ComboboxItem>
                        )}
                      </ComboboxCollection>
                    </ComboboxContent>
                  </Combobox>
                </FieldShell>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <SheetFooter className="mt-0 justify-end border-t border-[#e7dfd8] bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <SheetClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="submit"
            className="bg-[#1b1938] text-white hover:bg-[#0e0c1f]"
            disabled={isPending}
          >
            {isPending ? "Creating..." : "Create User"}
          </Button>
        </div>
      </SheetFooter>
    </form>
  );
}
