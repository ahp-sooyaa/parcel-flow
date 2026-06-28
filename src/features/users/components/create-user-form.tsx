"use client";

import { useId, useRef, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FieldShell,
  type FormFieldErrors,
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
import { SheetClose, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  defaultRole?: CreatableUserRole;
  roleOptions?: readonly CreatableUserRole[];
  title?: string;
}>;

type CreateUserFormValues = {
  name: string;
  phoneNumber: string;
  address: string;
  age: string;
  role: CreatableUserRole;
  password: string;
  shopName: string;
  selectedTownship: TownshipOption | null;
};

export function CreateUserForm({
  townships,
  defaultRole = "office_admin",
  roleOptions = creatableUserRoles,
  title = "Create User",
}: CreateUserFormProps) {
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

  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);

  const townshipOptions = buildTownshipOptions(townships);
  const { clearErrors, formState, handleSubmit, reset, setError, setValue, watch } =
    useForm<CreateUserFormValues>({
      defaultValues: {
        name: "",
        phoneNumber: "",
        address: "",
        age: "",
        role: defaultRole,
        password: generateTemporaryPassword(),
        shopName: "",
        selectedTownship: null,
      },
    });
  const values = watch();
  const errors = formState.errors;

  function clearFeedback(field?: keyof CreateUserFormValues) {
    if (field) {
      clearErrors(field);
    }

    if (submissionState?.kind === "error") {
      setSubmissionState(null);
    }
  }

  function applyFieldErrors(fieldErrors?: FormFieldErrors) {
    if (!fieldErrors) {
      return false;
    }

    const mappings = [
      ["name", "name"],
      ["phoneNumber", "phoneNumber"],
      ["address", "address"],
      ["age", "age"],
      ["shopName", "shopName"],
      ["serviceTownshipId", "selectedTownship"],
    ] as const;

    let hasMappedError = false;

    for (const [source, target] of mappings) {
      const message = fieldErrors[source];

      if (!message) {
        continue;
      }

      hasMappedError = true;
      setError(target, { type: "server", message });
    }

    return hasMappedError;
  }

  function submitForm(formValues: CreateUserFormValues) {
    setSubmissionState(null);
    clearErrors();

    startTransition(async () => {
      const result = await createUserAction({
        name: formValues.name,
        phoneNumber: formValues.phoneNumber,
        address: formValues.address,
        age: formValues.age,
        isActive: true,
        role: formValues.role,
        password: formValues.password,
        shopName: formValues.role === "merchant" ? formValues.shopName : undefined,
        serviceTownshipId:
          formValues.role === "rider" ? formValues.selectedTownship?.value : undefined,
      });

      if (!result.ok) {
        const hasMappedError = applyFieldErrors(result.fieldErrors);

        if (!hasMappedError || !result.fieldErrors) {
          setSubmissionState({
            kind: "error",
            message: result.message,
          });
        }

        return;
      }

      reset({
        ...values,
        name: "",
        phoneNumber: "",
        address: "",
        age: "",
        role: defaultRole,
        password: generateTemporaryPassword(),
        shopName: "",
        selectedTownship: null,
      });
      clearErrors();
      setSubmissionState({
        kind: "success",
        message: `${roleLabels[formValues.role]} account is ready to hand off.`,
        detail: `Password to share: ${result.temporaryPassword}`,
      });
    });
  }

  return (
    <form
      ref={overlayContainerRef}
      className="flex h-full flex-col bg-[#fcfbf8] text-[#292827]"
      onSubmit={handleSubmit(submitForm)}
    >
      <SheetHeader className="space-y-3 border-b border-[#e7dfd8] p-6 pb-4 text-left">
        <SheetTitle className="text-[2rem] font-semibold tracking-[-0.04em]">{title}</SheetTitle>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-6">
        <div className="space-y-5">
          {submissionState ? <FormBanner state={submissionState} /> : null}

          <Card className="border-[#e7dfd8] bg-white shadow-[0_20px_50px_rgba(27,25,56,0.06)]">
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell htmlFor={nameId} label="Name" required error={errors.name?.message}>
                  <Input
                    id={nameId}
                    value={values.name}
                    onChange={(event) => {
                      setValue("name", event.target.value);
                      clearFeedback("name");
                    }}
                    placeholder="Enter full name"
                    aria-invalid={Boolean(errors.name)}
                    className={inputClassName}
                    disabled={isPending}
                  />
                </FieldShell>

                <FieldShell
                  htmlFor={phoneNumberId}
                  label="Phone number"
                  required
                  error={errors.phoneNumber?.message}
                >
                  <Input
                    id={phoneNumberId}
                    value={values.phoneNumber}
                    onChange={(event) => {
                      setValue("phoneNumber", event.target.value);
                      clearFeedback("phoneNumber");
                    }}
                    placeholder="09xxxxxxxxx"
                    aria-invalid={Boolean(errors.phoneNumber)}
                    className={inputClassName}
                    disabled={isPending}
                  />
                </FieldShell>
              </div>

              <FieldShell
                htmlFor={addressId}
                label="Address"
                required
                error={errors.address?.message}
              >
                <Textarea
                  id={addressId}
                  value={values.address}
                  onChange={(event) => {
                    setValue("address", event.target.value);
                    clearFeedback("address");
                  }}
                  placeholder="Street, ward, township, landmark"
                  aria-invalid={Boolean(errors.address)}
                  className={textareaClassName}
                  disabled={isPending}
                />
              </FieldShell>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldShell htmlFor={ageId} label="Age (optional)" error={errors.age?.message}>
                  <Input
                    id={ageId}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={values.age}
                    onChange={(event) => {
                      setValue("age", event.target.value);
                      clearFeedback("age");
                    }}
                    placeholder="Optional"
                    className={inputClassName}
                    disabled={isPending}
                  />
                </FieldShell>

                <FieldShell htmlFor={roleId} label="Role" required>
                  <UserRoleSelectField
                    id={roleId}
                    value={values.role}
                    onChange={(nextRole) => {
                      setValue("role", nextRole);
                      clearFeedback("role");
                    }}
                    disabled={isPending || roleOptions.length === 1}
                    roles={roleOptions}
                  />
                </FieldShell>
              </div>

              <FieldShell htmlFor={passwordId} label="Generated password" required>
                <InputGroup className={groupedInputClassName}>
                  <InputGroupInput
                    id={passwordId}
                    value={values.password}
                    readOnly
                    className="h-full px-2 text-sm text-[#292827]"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      variant="ghost"
                      size="xs"
                      disabled={isPending}
                      onClick={() => {
                        setValue("password", generateTemporaryPassword());
                        clearFeedback("password");
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

              {values.role === "merchant" ? (
                <FieldShell htmlFor={shopId} label="Shop" required error={errors.shopName?.message}>
                  <Input
                    id={shopId}
                    value={values.shopName}
                    onChange={(event) => {
                      setValue("shopName", event.target.value);
                      clearFeedback("shopName");
                    }}
                    placeholder="Enter shop name"
                    aria-invalid={Boolean(errors.shopName)}
                    className={inputClassName}
                    disabled={isPending}
                  />
                </FieldShell>
              ) : null}

              {values.role === "rider" ? (
                <FieldShell
                  htmlFor={serviceTownshipId}
                  label="Service township"
                  required
                  error={errors.selectedTownship?.message}
                >
                  <Combobox
                    items={townshipOptions}
                    value={values.selectedTownship}
                    onValueChange={(nextValue) => {
                      setValue("selectedTownship", nextValue ?? null);
                      clearFeedback("selectedTownship");
                    }}
                    itemToStringLabel={(option) => option.label}
                    isItemEqualToValue={(item, value) => item.value === value.value}
                  >
                    <ComboboxInput
                      id={serviceTownshipId}
                      aria-label="Select rider service township"
                      placeholder="Search township"
                      aria-invalid={Boolean(errors.selectedTownship)}
                      showClear={values.selectedTownship !== null}
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
