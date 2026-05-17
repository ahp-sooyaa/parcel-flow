"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Pencil, Plus, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
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
import { SheetClose, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import {
  createUserBankAccountAction,
  updateUserAction,
  updateUserBankAccountAction,
} from "@/features/users/server/actions";
import type { BankAccountDto, UserListItemDto } from "@/features/users/server/dto";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { userRoles, type UserRole } from "@/lib/domain";

type BankAccountFormMode = "create" | "edit";

type BankAccountFormInput = {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  isPrimary: boolean;
};

type EditUserFormValues = {
  name: string;
  phoneNumber: string;
  address: string;
  age: string;
  isActive: boolean;
  role: UserRole;
  shopName: string;
  selectedTownship: TownshipOption | null;
};

export function EditUserForm({
  user,
  initialBankAccounts,
  townships,
}: Readonly<{
  user: UserListItemDto;
  initialBankAccounts: BankAccountDto[];
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

  const { handleSubmit, setValue, watch } = useForm<EditUserFormValues>({
    defaultValues: {
      name: user.name,
      phoneNumber: user.phoneNumber,
      address: user.address,
      age: user.age ? String(user.age) : "",
      isActive: user.isActive,
      role: user.role,
      shopName: user.shopName ?? "",
      selectedTownship: initialTownship,
    },
  });
  const values = watch();
  const [bankAccounts, setBankAccounts] = useState(initialBankAccounts);
  const [bankAccountFormMode, setBankAccountFormMode] = useState<BankAccountFormMode | null>(null);
  const [editingBankAccountId, setEditingBankAccountId] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const isBusy = isPending || isPasswordResetPending;
  const orderedBankAccounts = useMemo(
    () =>
      bankAccounts.toSorted(
        (left, right) =>
          Number(right.isPrimary) - Number(left.isPrimary) ||
          left.bankName.localeCompare(right.bankName),
      ),
    [bankAccounts],
  );

  function handlePasswordReset() {
    setSubmissionState(null);

    startPasswordResetTransition(async () => {
      try {
        const result = await regeneratePasswordAction({
          targetUserId: user.id,
        });

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

  function closeBankAccountForm() {
    setBankAccountFormMode(null);
    setEditingBankAccountId(null);
  }

  async function handleCreateBankAccount(input: BankAccountFormInput) {
    const result = await createUserBankAccountAction({
      userId: user.id,
      ...input,
    });

    if (!result.ok) {
      return result;
    }

    setBankAccounts((currentAccounts) =>
      reconcilePrimaryAccount([...currentAccounts, result.bankAccount]),
    );
    closeBankAccountForm();

    return result;
  }

  async function handleUpdateBankAccount(bankAccount: BankAccountDto, input: BankAccountFormInput) {
    const result = await updateUserBankAccountAction({
      id: bankAccount.id,
      userId: user.id,
      ...input,
    });

    if (!result.ok) {
      return result;
    }

    setBankAccounts((currentAccounts) =>
      reconcilePrimaryAccount(
        currentAccounts.map((currentAccount) =>
          currentAccount.id === bankAccount.id ? result.bankAccount : currentAccount,
        ),
      ),
    );
    closeBankAccountForm();

    return result;
  }

  function submitForm(payload: EditUserFormValues) {
    setSubmissionState(null);

    startTransition(async () => {
      const result = await updateUserAction({
        id: user.id,
        name: payload.name,
        phoneNumber: payload.phoneNumber,
        address: payload.address,
        age: payload.age,
        isActive: payload.isActive,
        role: payload.role,
        shopName: payload.role === "merchant" ? payload.shopName : undefined,
        serviceTownshipId: payload.role === "rider" ? payload.selectedTownship?.value : undefined,
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
        message: `${payload.name} has been saved.`,
        detail: "The persisted profile data will be reflected after refresh.",
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
                      value={values.name}
                      onChange={(event) => {
                        setValue("name", event.target.value);
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
                      value={values.phoneNumber}
                      onChange={(event) => {
                        setValue("phoneNumber", event.target.value);
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
                    value={values.address}
                    onChange={(event) => {
                      setValue("address", event.target.value);
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
                      value={values.age}
                      onChange={(event) => {
                        setValue("age", event.target.value);
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
                      value={values.role}
                      onChange={(nextRole) => {
                        setValue("role", nextRole);
                        setSubmissionState(null);

                        if (nextRole !== "merchant") {
                          setValue("shopName", "");
                        }

                        if (nextRole !== "rider") {
                          setValue("selectedTownship", null);
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
                    checked={values.isActive}
                    onCheckedChange={(checked) => {
                      setValue("isActive", checked);
                      setSubmissionState(null);
                    }}
                    disabled={isBusy}
                  />
                </div>

                {values.role === "merchant" ? (
                  <FieldShell htmlFor={shopId} label="Shop">
                    <Input
                      id={shopId}
                      value={values.shopName}
                      onChange={(event) => {
                        setValue("shopName", event.target.value);
                        setSubmissionState(null);
                      }}
                      placeholder="Enter shop name"
                      className={inputClassName}
                      disabled={isBusy}
                    />
                  </FieldShell>
                ) : null}

                {values.role === "rider" ? (
                  <FieldShell htmlFor={serviceTownshipId} label="Service township">
                    <Combobox
                      items={townshipOptions}
                      value={values.selectedTownship}
                      onValueChange={(township = null) => {
                        setValue("selectedTownship", township);
                        setSubmissionState(null);
                      }}
                      itemToStringLabel={(option) => option.label}
                      isItemEqualToValue={(item, value) => item.value === value.value}
                    >
                      <ComboboxInput
                        id={serviceTownshipId}
                        aria-label="Select rider service township"
                        placeholder="Search township"
                        showClear={values.selectedTownship !== null}
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

                <div className="flex justify-end gap-2 border-t border-[#f0e7df] pt-5">
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bank">
            <div className="grid gap-3">
              {bankAccountFormMode === "create" ? (
                <CompactBankAccountForm
                  mode="create"
                  initialValue={null}
                  onCancel={closeBankAccountForm}
                  onSubmit={handleCreateBankAccount}
                />
              ) : (
                <button
                  type="button"
                  className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#dcd4cd] bg-[#fcfbf8] p-5 text-sm font-medium text-[#73706d] transition-colors hover:border-[#1b1938] hover:bg-white hover:text-[#292827] focus-visible:border-[#1b1938] focus-visible:ring-3 focus-visible:ring-[#c9b4fa]/50 focus-visible:outline-none"
                  onClick={() => {
                    setBankAccountFormMode("create");
                    setEditingBankAccountId(null);
                  }}
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-white text-[#1b1938] shadow-xs ring-1 ring-[#e8e4dd]">
                    <Plus className="size-4" />
                  </span>
                  Add Bank Account
                </button>
              )}

              {orderedBankAccounts.map((bankAccount) =>
                bankAccountFormMode === "edit" && editingBankAccountId === bankAccount.id ? (
                  <CompactBankAccountForm
                    key={bankAccount.id}
                    mode="edit"
                    initialValue={bankAccount}
                    onCancel={closeBankAccountForm}
                    onSubmit={(input) => handleUpdateBankAccount(bankAccount, input)}
                  />
                ) : (
                  <BankAccountCard
                    key={bankAccount.id}
                    bankAccount={bankAccount}
                    onEdit={() => {
                      setBankAccountFormMode("edit");
                      setEditingBankAccountId(bankAccount.id);
                    }}
                  />
                ),
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </form>
  );
}

function BankAccountCard({
  bankAccount,
  onEdit,
}: Readonly<{
  bankAccount: BankAccountDto;
  onEdit: () => void;
}>) {
  return (
    <div className="relative min-h-36 rounded-lg border border-[#e7dfd8] bg-white p-5 text-[#292827] shadow-[0_20px_50px_rgba(27,25,56,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-base leading-5 font-medium">{bankAccount.bankName}</p>
          <p className="truncate text-sm leading-5 text-[#73706d]">
            {bankAccount.accountHolderName}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-[#73706d] hover:bg-[#f6f2ed] hover:text-[#292827]"
          aria-label={`Edit ${bankAccount.bankName} bank account`}
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </Button>
      </div>

      <div className="mt-7 flex items-end justify-between gap-3">
        <p className="font-mono text-lg leading-6 font-semibold tracking-normal break-all text-[#292827]">
          {bankAccount.accountNumber}
        </p>
        <Badge
          variant={getBankAccountBadgeVariant(bankAccount)}
          className="border-[#e8e4dd] bg-[#fcfbf8] text-[#292827] shadow-xs"
        >
          {getBankAccountBadgeLabel(bankAccount)}
        </Badge>
      </div>
    </div>
  );
}

function CompactBankAccountForm({
  mode,
  initialValue,
  onCancel,
  onSubmit,
}: Readonly<{
  mode: BankAccountFormMode;
  initialValue: BankAccountDto | null;
  onCancel: () => void;
  onSubmit: (
    input: BankAccountFormInput,
  ) => Promise<{ ok: true; message: string } | { ok: false; message: string }>;
}>) {
  const [isPending, startTransition] = useTransition();
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const bankNameId = useId();
  const accountHolderNameId = useId();
  const accountNumberId = useId();
  const primaryAccountId = useId();

  const { handleSubmit, reset, setValue, watch } = useForm<BankAccountFormInput>({
    defaultValues: getBankAccountFormInput(initialValue),
  });
  const values = watch();

  useEffect(() => {
    reset(getBankAccountFormInput(initialValue));
    setSubmissionState(null);
  }, [initialValue, reset]);

  function submitForm(payload: BankAccountFormInput) {
    setSubmissionState(null);

    startTransition(async () => {
      const result = await onSubmit(payload);

      if (!result.ok) {
        setSubmissionState({
          kind: "error",
          message: result.message,
        });
      }
    });
  }

  const submitLabel = mode === "create" ? "Add Account" : "Save";
  const pendingLabel = mode === "create" ? "Adding..." : "Saving...";

  return (
    <div
      role="group"
      className="space-y-3 rounded-lg border border-[#e7dfd8] bg-white p-4 shadow-[0_20px_50px_rgba(27,25,56,0.06)]"
    >
      {submissionState ? <FormBanner state={submissionState} /> : null}

      <div className="grid gap-3">
        <FieldShell htmlFor={bankNameId} label="Bank name">
          <Input
            id={bankNameId}
            value={values.bankName}
            onChange={(event) => {
              setValue("bankName", event.target.value);
              setSubmissionState(null);
            }}
            placeholder="KBZ Bank"
            className={inputClassName}
            disabled={isPending}
          />
        </FieldShell>

        <FieldShell htmlFor={accountHolderNameId} label="Account holder">
          <Input
            id={accountHolderNameId}
            value={values.accountHolderName}
            onChange={(event) => {
              setValue("accountHolderName", event.target.value);
              setSubmissionState(null);
            }}
            placeholder="Account holder name"
            className={inputClassName}
            disabled={isPending}
          />
        </FieldShell>

        <FieldShell htmlFor={accountNumberId} label="Account number">
          <Input
            id={accountNumberId}
            value={values.accountNumber}
            onChange={(event) => {
              setValue("accountNumber", event.target.value);
              setSubmissionState(null);
            }}
            placeholder="Enter account number"
            className={inputClassName}
            disabled={isPending}
          />
        </FieldShell>
      </div>

      <div className="grid gap-2">
        <CompactToggleField
          id={primaryAccountId}
          label="Primary"
          checked={values.isPrimary}
          disabled={isPending}
          onCheckedChange={(checked) => {
            setValue("isPrimary", checked);
            setSubmissionState(null);
          }}
        />
      </div>

      <div className="flex justify-end gap-2 border-t border-[#f0e7df] pt-3">
        <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-[#1b1938] text-white hover:bg-[#0e0c1f]"
          disabled={isPending}
          onClick={handleSubmit(submitForm)}
        >
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}

function CompactToggleField({
  id,
  label,
  checked,
  disabled,
  onCheckedChange,
}: Readonly<{
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}>) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-[#dcd4cd] bg-[#fcfbf8] px-3 py-2">
      <Label htmlFor={id} className="text-sm font-medium text-[#292827]">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

function reconcilePrimaryAccount(bankAccounts: BankAccountDto[]) {
  const primaryAccountId = bankAccounts.findLast((bankAccount) => bankAccount.isPrimary)?.id;

  if (!primaryAccountId) {
    return bankAccounts;
  }

  return bankAccounts.map((bankAccount) => ({
    ...bankAccount,
    isPrimary: bankAccount.id === primaryAccountId,
  }));
}

function getBankAccountBadgeLabel(bankAccount: BankAccountDto) {
  if (bankAccount.isPrimary) {
    return "Primary";
  }

  if (bankAccount.isCompanyAccount) {
    return "Company";
  }

  return "Personal";
}

function getBankAccountBadgeVariant(bankAccount: BankAccountDto) {
  return bankAccount.isPrimary ? "success" : "secondary";
}

function getBankAccountFormInput(bankAccount: BankAccountDto | null): BankAccountFormInput {
  return {
    bankName: bankAccount?.bankName ?? "",
    accountHolderName: bankAccount?.accountHolderName ?? "",
    accountNumber: bankAccount?.accountNumber ?? "",
    isPrimary: bankAccount?.isPrimary ?? false,
  };
}
