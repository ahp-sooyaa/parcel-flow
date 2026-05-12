"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inputClassName } from "@/components/shared/form-fields";
import type { TownshipListItemDto } from "@/features/townships/server/dto";
import { roleLabels, type UserRole } from "@/lib/domain";
export { generateTemporaryPassword } from "@/lib/password";

export type TownshipOption = {
  value: string;
  label: string;
  helper: string;
};

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
