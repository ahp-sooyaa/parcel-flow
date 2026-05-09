import type { UserListItemDto } from "@/features/auth/server/dto";

const users: UserListItemDto[] = [
  {
    id: "user-1",
    name: "Demo Super Admin",
    phoneNumber: "09000000000",
    role: "super_admin",
    isActive: true,
    mustResetPassword: false,
  },
  {
    id: "user-2",
    name: "Operations Admin",
    phoneNumber: "09111111111",
    role: "office_admin",
    isActive: true,
    mustResetPassword: false,
  },
];

export async function listUsers() {
  return users;
}
