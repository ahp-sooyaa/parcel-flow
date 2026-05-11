"use client";

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { roleLabels, type UserRole } from "@/lib/domain";
export { generateTemporaryPassword } from "@/lib/password";

export type TownshipOption = {
  value: string;
  label: string;
  helper: string;
};

export type FormMessageState = {
  kind: "success" | "error";
  message: string;
  detail?: string;
};

export const inputClassName =
  "h-10 rounded-md border-[#dcd4cd] bg-[#fcfbf8] text-sm text-[#292827] shadow-none placeholder:text-sm placeholder:text-[#9a9794] focus-visible:border-[#1b1938] focus-visible:ring-[#c9b4fa]";

export const groupedInputClassName =
  "h-10 rounded-md border-[#dcd4cd] bg-[#fcfbf8] text-sm text-[#292827] shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-[#1b1938] has-[[data-slot=input-group-control]:focus-visible]:ring-[#c9b4fa]";

export const textareaClassName =
  "min-h-28 rounded-md border-[#dcd4cd] bg-[#fcfbf8] text-sm text-[#292827] shadow-none placeholder:text-sm placeholder:text-[#9a9794] focus-visible:border-[#1b1938] focus-visible:ring-[#c9b4fa]";

export function FieldShell({
  htmlFor,
  label,
  children,
}: Readonly<{
  htmlFor: string;
  label: string;
  children: ReactNode;
}>) {
  return (
    <div className="space-y-2.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-[#292827]">
        {label}
      </Label>
      <div>{children}</div>
    </div>
  );
}

export function UserRoleSelectField<Role extends UserRole>({
  id,
  value,
  onChange,
  disabled,
  roles,
}: Readonly<{
  id: string;
  value: Role;
  onChange: (value: Role) => void;
  disabled: boolean;
  roles: readonly Role[];
}>) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) {
          onChange(nextValue);
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={inputClassName}>
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((roleOption) => (
          <SelectItem key={roleOption} value={roleOption}>
            {roleLabels[roleOption]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FormBanner({
  state,
}: Readonly<{
  state: FormMessageState;
}>) {
  const isSuccess = state.kind === "success";

  return (
    <div
      className={
        isSuccess
          ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          : "rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
      }
    >
      <p className="font-medium">{state.message}</p>
      {state.detail ? <p className="mt-1 text-xs">{state.detail}</p> : null}
    </div>
  );
}

export function buildTownshipOptions(townships: TownshipListItemDto[]) {
  return townships
    .filter((township) => township.isActive)
    .map<TownshipOption>((township) => ({
      value: township.id,
      label: township.name,
      helper: "Active delivery zone",
    }));
}

export function findTownshipOption(
  options: TownshipOption[],
  townshipId: string | null,
  townshipName: string | null,
) {
  return (
    options.find((option) => option.value === townshipId) ??
    options.find((option) => option.label === townshipName) ??
    null
  );
}
