import type { BankAccountDto, UserListItemDto } from "@/features/users/server/dto";

const users: UserListItemDto[] = [
  {
    id: "user-1",
    name: "Demo Super Admin",
    phoneNumber: "09000000000",
    address: "Sanchaung Head Office",
    age: 34,
    role: "super_admin",
    shopName: null,
    serviceTownshipId: null,
    serviceTownshipName: null,
    isActive: true,
    mustResetPassword: false,
  },
  {
    id: "user-2",
    name: "Operations Admin",
    phoneNumber: "09111111111",
    address: "Tamwe Township, Yangon",
    age: 29,
    role: "office_admin",
    shopName: null,
    serviceTownshipId: null,
    serviceTownshipName: null,
    isActive: true,
    mustResetPassword: false,
  },
  {
    id: "user-3",
    name: "Daw Hnin",
    phoneNumber: "09900111222",
    address: "Sanchaung Township, Yangon",
    age: 41,
    role: "merchant",
    shopName: "North Star Mart",
    serviceTownshipId: null,
    serviceTownshipName: null,
    isActive: true,
    mustResetPassword: true,
  },
  {
    id: "user-4",
    name: "Ko Min",
    phoneNumber: "09700001111",
    address: "Hlaing Township, Yangon",
    age: 26,
    role: "rider",
    shopName: null,
    serviceTownshipId: "township-1",
    serviceTownshipName: "Sanchaung",
    isActive: true,
    mustResetPassword: false,
  },
];

const bankAccounts: BankAccountDto[] = [
  {
    id: "bank-account-1",
    userId: "user-1",
    bankName: "KBZ Bank",
    accountHolderName: "AungHtetPaing",
    accountNumber: "091234123456",
    isCompanyAccount: false,
    isPrimary: true,
  },
  {
    id: "bank-account-2",
    userId: "user-1",
    bankName: "AYA Bank",
    accountHolderName: "Parcel Flow Company",
    accountNumber: "105567891234",
    isCompanyAccount: true,
    isPrimary: false,
  },
  {
    id: "bank-account-3",
    userId: "user-3",
    bankName: "CB Bank",
    accountHolderName: "Daw Hnin",
    accountNumber: "221122334455",
    isCompanyAccount: false,
    isPrimary: true,
  },
  {
    id: "bank-account-4",
    userId: "user-4",
    bankName: "UAB Bank",
    accountHolderName: "Ko Min",
    accountNumber: "998877665544",
    isCompanyAccount: false,
    isPrimary: true,
  },
];

export async function listUsers() {
  return users;
}

export async function getUserById(id: string) {
  return users.find((user) => user.id === id) ?? null;
}

export async function listBankAccountsForUser(userId: string) {
  return bankAccounts.filter((bankAccount) => bankAccount.userId === userId);
}
