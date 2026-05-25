"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FormMessageState = {
  kind: "success" | "error";
  message: string;
  detail?: string;
};

export type FormFieldErrors = Partial<Record<string, string>>;

export const inputClassName =
  "h-10 rounded-md border-[#dcd4cd] bg-[#fcfbf8] text-sm text-[#292827] shadow-none placeholder:text-sm placeholder:text-[#9a9794] focus-visible:border-[#1b1938] focus-visible:ring-[#c9b4fa]";

export const groupedInputClassName =
  "h-10 rounded-md border-[#dcd4cd] bg-[#fcfbf8] text-sm text-[#292827] shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-[#1b1938] has-[[data-slot=input-group-control]:focus-visible]:ring-[#c9b4fa]";

export const textareaClassName =
  "min-h-28 rounded-md border-[#dcd4cd] bg-[#fcfbf8] text-sm text-[#292827] shadow-none placeholder:text-sm placeholder:text-[#9a9794] focus-visible:border-[#1b1938] focus-visible:ring-[#c9b4fa]";

export function FieldShell({
  htmlFor,
  label,
  required = false,
  error,
  children,
}: Readonly<{
  htmlFor: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}>) {
  return (
    <div className="space-y-2.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-[#292827]">
        {label}
        {required ? <span className="text-rose-700"> *</span> : null}
      </Label>
      <div>{children}</div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

export function FormBanner({
  state,
}: Readonly<{
  state: FormMessageState;
}>) {
  useEffect(() => {
    const showToast = state.kind === "success" ? toast.success : toast.error;
    const toastId = `${state.kind}:${state.message}:${state.detail ?? ""}`;

    showToast(state.message, {
      id: toastId,
      description: state.detail,
      position: "top-center",
    });
  }, [state.detail, state.kind, state.message]);

  return null;
}

export function MoneyInput({
  id,
  value,
  onChange,
  placeholder = "0",
  disabled = false,
}: Readonly<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}>) {
  return (
    <InputGroup className={groupedInputClassName}>
      <InputGroupAddon align="inline-start">
        <InputGroupText className="text-[10px] font-semibold tracking-[0.18em] text-[#73706d] uppercase">
          Ks
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        type="number"
        min="0"
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full px-2 text-sm text-[#292827] placeholder:text-[#9a9794]"
        disabled={disabled}
      />
    </InputGroup>
  );
}

export function NumberInput({
  id,
  value,
  onChange,
  suffix,
  inputMode = "numeric",
  placeholder = "0",
  disabled = false,
}: Readonly<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  inputMode?: "numeric" | "decimal";
  placeholder?: string;
  disabled?: boolean;
}>) {
  if (!suffix) {
    return (
      <Input
        id={id}
        type="number"
        min="0"
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
        disabled={disabled}
      />
    );
  }

  return (
    <InputGroup className={groupedInputClassName}>
      <InputGroupInput
        id={id}
        type="number"
        min="0"
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full px-2 text-sm text-[#292827] placeholder:text-[#9a9794]"
        disabled={disabled}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText className="text-[10px] font-semibold tracking-[0.18em] text-[#73706d] uppercase">
          {suffix}
        </InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}
