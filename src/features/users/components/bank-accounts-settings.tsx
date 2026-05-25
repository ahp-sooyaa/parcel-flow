"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FieldShell,
  type FormFieldErrors,
  FormBanner,
  inputClassName,
  type FormMessageState,
} from "@/components/shared/form-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createOwnBankAccountAction,
  updateOwnBankAccountAction,
} from "@/features/users/server/actions";
import type { BankAccountDto, UserListItemDto } from "@/features/users/server/dto";

type BankAccountsSettingsProps = Readonly<{
  user: UserListItemDto;
  initialBankAccounts: BankAccountDto[];
}>;

type BankAccountDialogProps = Readonly<{
  open: boolean;
  mode: "create" | "edit";
  initialValue: BankAccountDto | null;
  onClose: () => void;
  onSubmit: (bankAccount: BankAccountDto) => void;
}>;

export function BankAccountsSettings({ user, initialBankAccounts }: BankAccountsSettingsProps) {
  const canManageBankAccounts = user.role === "super_admin";
  const [bankAccounts, setBankAccounts] = useState(initialBankAccounts);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccountDto | null>(null);

  const orderedBankAccounts = useMemo(
    () =>
      bankAccounts.toSorted(
        (left, right) =>
          Number(right.isPrimary) - Number(left.isPrimary) ||
          left.bankName.localeCompare(right.bankName),
      ),
    [bankAccounts],
  );

  function handleCreate(bankAccount: BankAccountDto) {
    setBankAccounts((currentAccounts) =>
      reconcilePrimaryAccount([
        ...currentAccounts,
        {
          ...bankAccount,
          userId: user.id,
        },
      ]),
    );
    setIsCreateOpen(false);
  }

  function handleEdit(bankAccount: BankAccountDto) {
    setBankAccounts((currentAccounts) =>
      reconcilePrimaryAccount(
        currentAccounts.map((currentAccount) =>
          currentAccount.id === bankAccount.id
            ? {
                ...bankAccount,
                userId: user.id,
              }
            : currentAccount,
        ),
      ),
    );
    setEditingBankAccount(null);
  }

  return (
    <>
      {orderedBankAccounts.length === 0 ? (
        <EmptyBankAccountsState
          canManageBankAccounts={canManageBankAccounts}
          onCreate={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {canManageBankAccounts ? (
            <button
              type="button"
              className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#dcd4cd] bg-[#fcfbf8] p-5 text-sm font-medium text-[#73706d] transition-colors hover:border-[#1b1938] hover:bg-white hover:text-[#292827] focus-visible:border-[#1b1938] focus-visible:ring-3 focus-visible:ring-[#c9b4fa]/50 focus-visible:outline-none"
              onClick={() => setIsCreateOpen(true)}
            >
              <span className="flex size-8 items-center justify-center rounded-md bg-white text-[#1b1938] shadow-xs ring-1 ring-[#e8e4dd]">
                <Plus className="size-4" />
              </span>{" "}
              Add Bank Account
            </button>
          ) : null}
          {orderedBankAccounts.map((bankAccount) => (
            <div
              key={bankAccount.id}
              className="relative min-h-36 rounded-lg border border-[#e7dfd8] bg-white p-5 text-[#292827]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-base leading-5 font-medium">{bankAccount.bankName}</p>
                  <p className="truncate text-sm leading-5 text-[#73706d]">
                    {bankAccount.accountHolderName}
                  </p>
                </div>
                {canManageBankAccounts ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-[#73706d] hover:bg-[#f6f2ed] hover:text-[#292827]"
                    aria-label={`Edit ${bankAccount.bankName} bank account`}
                    onClick={() => setEditingBankAccount(bankAccount)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                ) : null}
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
          ))}
        </div>
      )}

      {canManageBankAccounts ? (
        <>
          <BankAccountDialog
            open={isCreateOpen}
            mode="create"
            initialValue={null}
            onClose={() => setIsCreateOpen(false)}
            onSubmit={handleCreate}
          />

          <BankAccountDialog
            open={editingBankAccount !== null}
            mode="edit"
            initialValue={editingBankAccount}
            onClose={() => setEditingBankAccount(null)}
            onSubmit={handleEdit}
          />
        </>
      ) : null}
    </>
  );
}

function EmptyBankAccountsState({
  canManageBankAccounts,
  onCreate,
}: Readonly<{
  canManageBankAccounts: boolean;
  onCreate: () => void;
}>) {
  if (canManageBankAccounts) {
    return (
      <button
        type="button"
        className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#dcd4cd] bg-[#fcfbf8] px-5 py-10 text-center text-sm font-medium text-[#73706d] transition-colors hover:border-[#1b1938] hover:bg-white hover:text-[#292827] focus-visible:border-[#1b1938] focus-visible:ring-3 focus-visible:ring-[#c9b4fa]/50 focus-visible:outline-none"
        onClick={onCreate}
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-white text-[#1b1938] shadow-xs ring-1 ring-[#e8e4dd]">
          <Plus className="size-4" />
        </span>{" "}
        Add Bank Account
      </button>
    );
  }

  return (
    <div className="flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#dcd4cd] bg-[#fcfbf8] px-5 py-10 text-center">
      <p className="text-sm font-medium text-[#292827]">No bank accounts yet</p>
      <p className="max-w-md text-sm leading-5 text-[#73706d]">
        Bank accounts are managed by super admins. Contact an admin when payout or settlement bank
        details need to be added.
      </p>
    </div>
  );
}

function BankAccountDialog({
  open,
  mode,
  initialValue,
  onClose,
  onSubmit,
}: BankAccountDialogProps) {
  const [isPending, startTransition] = useTransition();
  const submitLabel = mode === "create" ? "Create Bank Account" : "Save Changes";
  const pendingSubmitLabel = mode === "create" ? "Creating..." : "Saving...";
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const initialFormState = getBankAccountFormState(initialValue);
  const bankNameId = useId();
  const accountHolderNameId = useId();
  const accountNumberId = useId();
  const primaryAccountId = useId();

  const { clearErrors, formState, handleSubmit, reset, setError, setValue, watch } = useForm<
    ReturnType<typeof getBankAccountFormState>
  >({
    defaultValues: initialFormState,
  });
  const values = watch();
  const errors = formState.errors;

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(getBankAccountFormState(initialValue));
    clearErrors();
    setSubmissionState(null);
  }, [clearErrors, initialValue, open, reset]);

  function syncFormState(bankAccount: BankAccountDto | null) {
    reset(getBankAccountFormState(bankAccount));
    clearErrors();
    setSubmissionState(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      syncFormState(initialValue);
      onClose();
    }
  }

  function submitForm(payload: ReturnType<typeof getBankAccountFormState>) {
    setSubmissionState(null);
    clearErrors();

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createOwnBankAccountAction(payload)
          : await updateOwnBankAccountAction({
              id: initialValue?.id ?? "",
              ...payload,
            });

      if (!result.ok) {
        const hasMappedError = applyFieldErrors(result.fieldErrors, setError);

        if (!hasMappedError || !result.fieldErrors) {
          setSubmissionState({
            kind: "error",
            message: result.message,
          });
        }
        return;
      }

      onSubmit(result.bankAccount);
      syncFormState(null);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[640px] gap-5 p-0 sm:max-w-[640px]">
        <form className="space-y-5 p-6" onSubmit={handleSubmit(submitForm)}>
          <DialogHeader>
            <DialogTitle className="text-xl">
              {mode === "create" ? "Add Bank Account" : "Edit Bank Account"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Enter the bank details that should be available from your settings page."
                : "Update the selected bank account details in this dialog."}
            </DialogDescription>
          </DialogHeader>

          {submissionState ? <FormBanner state={submissionState} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell
              htmlFor={bankNameId}
              label="Bank name"
              required
              error={errors.bankName?.message}
            >
              <Input
                id={bankNameId}
                value={values.bankName}
                onChange={(event) => {
                  setValue("bankName", event.target.value);
                  clearErrors("bankName");
                  setSubmissionState(null);
                }}
                placeholder="KBZ Bank"
                aria-invalid={Boolean(errors.bankName)}
                className={inputClassName}
                disabled={isPending}
              />
            </FieldShell>

            <FieldShell
              htmlFor={accountHolderNameId}
              label="Account holder name"
              required
              error={errors.accountHolderName?.message}
            >
              <Input
                id={accountHolderNameId}
                value={values.accountHolderName}
                onChange={(event) => {
                  setValue("accountHolderName", event.target.value);
                  clearErrors("accountHolderName");
                  setSubmissionState(null);
                }}
                placeholder="Account holder name"
                aria-invalid={Boolean(errors.accountHolderName)}
                className={inputClassName}
                disabled={isPending}
              />
            </FieldShell>
          </div>

          <FieldShell
            htmlFor={accountNumberId}
            label="Account number"
            required
            error={errors.accountNumber?.message}
          >
            <Input
              id={accountNumberId}
              value={values.accountNumber}
              onChange={(event) => {
                setValue("accountNumber", event.target.value);
                clearErrors("accountNumber");
                setSubmissionState(null);
              }}
              placeholder="Enter account number"
              aria-invalid={Boolean(errors.accountNumber)}
              className={inputClassName}
              disabled={isPending}
            />
          </FieldShell>

          <div className="grid gap-4">
            <ToggleField
              id={primaryAccountId}
              label="Primary account"
              description="Mark this as the default bank account."
              checked={values.isPrimary}
              disabled={isPending}
              onCheckedChange={(checked) => {
                setValue("isPrimary", checked);
                setSubmissionState(null);
              }}
            />
          </div>

          <DialogFooter className="border-t px-0 pt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? pendingSubmitLabel : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleField({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: Readonly<{
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}>) {
  return (
    <div className="grid gap-4 rounded-lg border border-dashed border-[#dcd4cd] bg-[#fcfbf8] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="space-y-1">
        <label htmlFor={id} className="text-sm font-medium text-[#292827]">
          {label}
        </label>
        <p className="text-sm text-[#5f5b58]">{description}</p>
      </div>
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

function getBankAccountFormState(bankAccount: BankAccountDto | null) {
  return {
    bankName: bankAccount?.bankName ?? "",
    accountHolderName: bankAccount?.accountHolderName ?? "",
    accountNumber: bankAccount?.accountNumber ?? "",
    isPrimary: bankAccount?.isPrimary ?? false,
  };
}

function applyFieldErrors(
  fieldErrors: FormFieldErrors | undefined,
  setError: ReturnType<typeof useForm<ReturnType<typeof getBankAccountFormState>>>["setError"],
) {
  if (!fieldErrors) {
    return false;
  }

  const fieldKeys: (keyof ReturnType<typeof getBankAccountFormState>)[] = [
    "bankName",
    "accountHolderName",
    "accountNumber",
  ];
  let hasMappedError = false;

  for (const key of fieldKeys) {
    const message = fieldErrors[key];

    if (!message) {
      continue;
    }

    hasMappedError = true;
    setError(key, {
      type: "server",
      message,
    });
  }

  return hasMappedError;
}
