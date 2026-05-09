import type { UserRole } from "@/lib/domain";

export type UserListItemDto = {
  id: string;
  name: string;
  phoneNumber: string;
  role: UserRole;
  isActive: boolean;
  mustResetPassword: boolean;
};
