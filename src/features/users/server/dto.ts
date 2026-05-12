import type { UserRole } from "@/lib/domain";

export type UserListItemDto = {
  id: string;
  name: string;
  phoneNumber: string;
  address: string;
  age: number | null;
  role: UserRole;
  shopName: string | null;
  serviceTownshipId: string | null;
  serviceTownshipName: string | null;
  isActive: boolean;
  mustResetPassword: boolean;
};

export type BankAccountDto = {
  id: string;
  userId: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  isCompanyAccount: boolean;
  isPrimary: boolean;
};
