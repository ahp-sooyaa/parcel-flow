"use client";

import type { SubmitEvent } from "react";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FieldShell,
  FormBanner,
  inputClassName,
  type FormMessageState,
} from "@/features/auth/components/user-form-support";
import {
  createOwnBankAccountAction,
  updateOwnBankAccountAction,
} from "@/features/auth/server/actions";
import type { BankAccountDto, UserListItemDto } from "@/features/auth/server/dto";

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
      <Card className="gap-3 overflow-visible py-0 ring-0">
        <CardHeader className="px-0">
          <CardTitle>Bank Accounts</CardTitle>
          <CardDescription>
            Add payout and settlement destinations for {user.name}. Create and edit both open in
            dialogs.
          </CardDescription>
          <CardAction>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="size-4" />
              Add Bank Account
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4 px-0">
          {orderedBankAccounts.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
              No bank accounts added yet. Use the dialog to create the first account.
            </div>
          ) : (
            <div className="rounded-xl border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank</TableHead>
                    <TableHead>Account Holder</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderedBankAccounts.map((bankAccount) => (
                    <TableRow key={bankAccount.id}>
                      <TableCell className="font-medium">{bankAccount.bankName}</TableCell>
                      <TableCell>{bankAccount.accountHolderName}</TableCell>
                      <TableCell>{bankAccount.accountNumber}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {bankAccount.isPrimary ? <Badge variant="success">Primary</Badge> : null}
                          {bankAccount.isCompanyAccount ? (
                            <Badge variant="outline">Company</Badge>
                          ) : (
                            <Badge variant="secondary">Personal</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingBankAccount(bankAccount)}
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
  const [submissionState, setSubmissionState] = useState<FormMessageState | null>(null);
  const initialFormState = getBankAccountFormState(initialValue);
  const bankNameId = useId();
  const accountHolderNameId = useId();
  const accountNumberId = useId();
  const companyAccountId = useId();
  const primaryAccountId = useId();

  const [bankName, setBankName] = useState(initialFormState.bankName);
  const [accountHolderName, setAccountHolderName] = useState(initialFormState.accountHolderName);
  const [accountNumber, setAccountNumber] = useState(initialFormState.accountNumber);
  const [isCompanyAccount, setIsCompanyAccount] = useState(initialFormState.isCompanyAccount);
  const [isPrimary, setIsPrimary] = useState(initialFormState.isPrimary);

  useEffect(() => {
    if (!open) {
      return;
    }

    syncFormState(initialValue);
  }, [initialValue, open]);

  function syncFormState(bankAccount: BankAccountDto | null) {
    setBankName(bankAccount?.bankName ?? "");
    setAccountHolderName(bankAccount?.accountHolderName ?? "");
    setAccountNumber(bankAccount?.accountNumber ?? "");
    setIsCompanyAccount(bankAccount?.isCompanyAccount ?? false);
    setIsPrimary(bankAccount?.isPrimary ?? false);
    setSubmissionState(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      syncFormState(initialValue);
      onClose();
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionState(null);

    startTransition(async () => {
      const payload = {
        bankName,
        accountHolderName,
        accountNumber,
        isCompanyAccount,
        isPrimary,
      };

      const result =
        mode === "create"
          ? await createOwnBankAccountAction(payload)
          : await updateOwnBankAccountAction({
              id: initialValue?.id ?? "",
              ...payload,
            });

      if (!result.ok) {
        setSubmissionState({
          kind: "error",
          message: result.message,
        });
        return;
      }

      onSubmit(result.bankAccount);
      syncFormState(null);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[640px] gap-5 p-0 sm:max-w-[640px]">
        <form className="space-y-5 p-6" onSubmit={handleSubmit}>
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
            <FieldShell htmlFor={bankNameId} label="Bank name">
              <Input
                id={bankNameId}
                value={bankName}
                onChange={(event) => {
                  setBankName(event.target.value);
                  setSubmissionState(null);
                }}
                placeholder="KBZ Bank"
                className={inputClassName}
                disabled={isPending}
              />
            </FieldShell>

            <FieldShell htmlFor={accountHolderNameId} label="Account holder name">
              <Input
                id={accountHolderNameId}
                value={accountHolderName}
                onChange={(event) => {
                  setAccountHolderName(event.target.value);
                  setSubmissionState(null);
                }}
                placeholder="Account holder name"
                className={inputClassName}
                disabled={isPending}
              />
            </FieldShell>
          </div>

          <FieldShell htmlFor={accountNumberId} label="Account number">
            <Input
              id={accountNumberId}
              value={accountNumber}
              onChange={(event) => {
                setAccountNumber(event.target.value);
                setSubmissionState(null);
              }}
              placeholder="Enter account number"
              className={inputClassName}
              disabled={isPending}
            />
          </FieldShell>

          <div className="grid gap-4 sm:grid-cols-2">
            <ToggleField
              id={companyAccountId}
              label="Company account"
              description="Use this for shared company settlement."
              checked={isCompanyAccount}
              disabled={isPending}
              onCheckedChange={(checked) => {
                setIsCompanyAccount(checked);
                setSubmissionState(null);
              }}
            />

            <ToggleField
              id={primaryAccountId}
              label="Primary account"
              description="Mark this as the default bank account."
              checked={isPrimary}
              disabled={isPending}
              onCheckedChange={(checked) => {
                setIsPrimary(checked);
                setSubmissionState(null);
              }}
            />
          </div>

          <DialogFooter className="border-t px-0 pt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? mode === "create"
                  ? "Creating..."
                  : "Saving..."
                : mode === "create"
                  ? "Create Bank Account"
                  : "Save Changes"}
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

function getBankAccountFormState(bankAccount: BankAccountDto | null) {
  return {
    bankName: bankAccount?.bankName ?? "",
    accountHolderName: bankAccount?.accountHolderName ?? "",
    accountNumber: bankAccount?.accountNumber ?? "",
    isCompanyAccount: bankAccount?.isCompanyAccount ?? false,
    isPrimary: bankAccount?.isPrimary ?? false,
  };
}
