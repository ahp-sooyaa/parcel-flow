import "server-only";
import type { RoleSlug } from "@/db/constants";

export type AppUserListItemDto = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  roleSlug: RoleSlug;
  isActive: boolean;
  mustResetPassword: boolean;
  createdAt: Date;
};

export type AppUserDetailDto = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  mustResetPassword: boolean;
  roleSlug: RoleSlug;
  roleLabel: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateUserActionResult = {
  ok: boolean;
  message: string;
  temporaryPassword?: string;
};

export type UpdateUserProfileActionResult = {
  ok: boolean;
  message: string;
};

export type SoftDeleteUserActionResult = {
  ok: boolean;
  message: string;
};

export type ResetUserPasswordActionResult = {
  ok: boolean;
  message: string;
  temporaryPassword?: string;
};

export function toAppUserListItemDto(input: AppUserListItemDto): AppUserListItemDto {
  return {
    id: input.id,
    fullName: input.fullName,
    email: input.email,
    phoneNumber: input.phoneNumber,
    roleSlug: input.roleSlug,
    isActive: input.isActive,
    mustResetPassword: input.mustResetPassword,
    createdAt: input.createdAt,
  };
}

export function toAppUserDetailDto(input: AppUserDetailDto): AppUserDetailDto {
  return {
    id: input.id,
    fullName: input.fullName,
    email: input.email,
    phoneNumber: input.phoneNumber,
    isActive: input.isActive,
    mustResetPassword: input.mustResetPassword,
    roleSlug: input.roleSlug,
    roleLabel: input.roleLabel,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}
