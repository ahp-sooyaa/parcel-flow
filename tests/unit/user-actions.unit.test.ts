import { beforeEach, describe, expect, mock, test } from "bun:test";

import { buildCreateUserInput, buildCurrentUser, buildUserListItem } from "../fixtures/builders";

const requireCurrentUserMock = mock(async () => buildCurrentUser());
const findUniqueUsernameMock = mock(async () => "test-user");
const createRoleProfileMock = mock(async () => undefined);
const getUserByIdMock = mock(async () => buildUserListItem({ role: "merchant" }));
const updateUserProfileMock = mock(async () => buildUserListItem({ role: "merchant" }));
const createBankAccountForUserMock = mock(async () => ({
  id: "bank-account-id",
  userId: "target-user-id",
  bankName: "KBZ Bank",
  accountHolderName: "Test Holder",
  accountNumber: "123456789",
  isCompanyAccount: false,
  isPrimary: true,
}));
const updateBankAccountForUserMock = mock(async () => ({
  id: "bank-account-id",
  userId: "target-user-id",
  bankName: "AYA Bank",
  accountHolderName: "Updated Holder",
  accountNumber: "987654321",
  isCompanyAccount: false,
  isPrimary: false,
}));
const createUserMock = mock(async () => ({ user: { id: "created-user-id" } }));
const headersMock = mock(async () => new Headers());
const revalidatePathMock = mock(() => undefined);
const dbWhereMock = mock(async () => undefined);
const dbSetMock = mock(() => ({ where: dbWhereMock }));
const dbUpdateMock = mock(() => ({ set: dbSetMock }));

void mock.module("@/lib/session", () => ({
  requireCurrentUser: requireCurrentUserMock,
}));

void mock.module("@/features/users/server/dal", () => ({
  createBankAccountForUser: createBankAccountForUserMock,
  createRoleProfile: createRoleProfileMock,
  findUniqueUsername: findUniqueUsernameMock,
  getUserById: getUserByIdMock,
  updateBankAccountForUser: updateBankAccountForUserMock,
  updateUserProfile: updateUserProfileMock,
}));

void mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      createUser: createUserMock,
    },
  },
}));

void mock.module("next/headers", () => ({
  headers: headersMock,
}));

void mock.module("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

void mock.module("@/db", () => ({
  db: {
    update: dbUpdateMock,
  },
}));

describe("user server actions", async () => {
  const {
    createOwnBankAccountAction,
    createUserAction,
    createUserBankAccountAction,
    updateOwnAccountAction,
    updateOwnAccountFormAction,
    updateOwnBankAccountAction,
    updateUserAction,
    updateUserBankAccountAction,
  } = await import("@/features/users/server/actions");

  beforeEach(() => {
    requireCurrentUserMock.mockReset();
    findUniqueUsernameMock.mockReset();
    createRoleProfileMock.mockReset();
    getUserByIdMock.mockReset();
    updateUserProfileMock.mockReset();
    createBankAccountForUserMock.mockReset();
    updateBankAccountForUserMock.mockReset();
    createUserMock.mockReset();
    headersMock.mockReset();
    revalidatePathMock.mockReset();
    dbWhereMock.mockReset();
    dbSetMock.mockReset();
    dbUpdateMock.mockReset();

    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ role: "super_admin" }));
    findUniqueUsernameMock.mockResolvedValue("test-user");
    createUserMock.mockResolvedValue({ user: { id: "created-user-id" } });
    headersMock.mockResolvedValue(new Headers());
    getUserByIdMock.mockResolvedValue(
      buildUserListItem({ id: "target-user-id", role: "merchant" }),
    );
    updateUserProfileMock.mockResolvedValue(
      buildUserListItem({ id: "target-user-id", role: "merchant" }),
    );
    createBankAccountForUserMock.mockResolvedValue({
      id: "bank-account-id",
      userId: "target-user-id",
      bankName: "KBZ Bank",
      accountHolderName: "Test Holder",
      accountNumber: "123456789",
      isCompanyAccount: false,
      isPrimary: true,
    });
    updateBankAccountForUserMock.mockResolvedValue({
      id: "bank-account-id",
      userId: "target-user-id",
      bankName: "AYA Bank",
      accountHolderName: "Updated Holder",
      accountNumber: "987654321",
      isCompanyAccount: false,
      isPrimary: false,
    });
    dbWhereMock.mockResolvedValue(undefined);
    dbSetMock.mockReturnValue({ where: dbWhereMock });
    dbUpdateMock.mockReturnValue({ set: dbSetMock });
  });

  test("rejects invalid create-user input before persistence", async () => {
    const result = await createUserAction({
      ...buildCreateUserInput(),
      password: "short",
    });

    expect(result.ok).toBe(false);
    expect(createUserMock).not.toHaveBeenCalled();
    expect(createRoleProfileMock).not.toHaveBeenCalled();
  });

  test("rejects unauthorized create-user role combinations before persistence", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ role: "office_admin" }));

    const result = await createUserAction(buildCreateUserInput({ role: "office_admin" }));

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to create this account type.",
    });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  test("creates authorized users through Better Auth and role profile persistence", async () => {
    const result = await createUserAction(buildCreateUserInput({ role: "merchant" }));

    expect(result.ok).toBe(true);
    expect(findUniqueUsernameMock).toHaveBeenCalledWith("Test Merchant");
    expect(createUserMock).toHaveBeenCalledWith({
      body: {
        name: "Test Merchant",
        email: "test-user@users.parcel-flow.local",
        password: "password123",
        role: "merchant",
        data: {
          username: "test-user",
          displayUsername: "test-user",
          phoneNumber: "09999999996",
          address: "Merchant address",
          age: 30,
          isActive: true,
          mustResetPassword: true,
        },
      },
      headers: expect.any(Headers),
    });
    expect(createRoleProfileMock).toHaveBeenCalledWith({
      userId: "created-user-id",
      role: "merchant",
      shopName: "Test Shop",
      address: "Merchant address",
      serviceTownshipId: undefined,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/users");
  });

  test("rejects invalid update-user input before loading target user", async () => {
    const result = await updateUserAction({ id: "" });

    expect(result.ok).toBe(false);
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  test("rejects unauthorized target user edits before persistence", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ role: "office_admin" }));
    getUserByIdMock.mockResolvedValue(
      buildUserListItem({ id: "target-user-id", role: "super_admin" }),
    );

    const result = await updateUserAction({
      ...buildCreateUserInput({ role: "merchant" }),
      id: "target-user-id",
      role: "merchant",
    });

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to edit this account.",
    });
    expect(updateUserProfileMock).not.toHaveBeenCalled();
  });

  test("returns not-found when updating a missing user", async () => {
    getUserByIdMock.mockImplementation(async () => null as never);

    const result = await updateUserAction({
      ...buildCreateUserInput({ role: "merchant" }),
      id: "missing-user-id",
    });

    expect(result).toEqual({
      ok: false,
      message: "User was not found.",
    });
    expect(updateUserProfileMock).not.toHaveBeenCalled();
  });

  test("updates authorized users and revalidates dependent pages", async () => {
    const result = await updateUserAction({
      ...buildCreateUserInput({ role: "merchant" }),
      id: "target-user-id",
      isActive: false,
    });

    expect(result.ok).toBe(true);
    expect(updateUserProfileMock).toHaveBeenCalledWith({
      id: "target-user-id",
      name: "Test Merchant",
      phoneNumber: "09999999996",
      address: "Merchant address",
      age: 30,
      isActive: false,
      role: "merchant",
      shopName: "Test Shop",
      serviceTownshipId: undefined,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/users");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/merchants");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/riders");
  });

  test("rejects invalid own-account updates before touching the database", async () => {
    const result = await updateOwnAccountAction({
      name: "",
      phoneNumber: "09123",
      address: "",
      age: "",
    });

    expect(result.ok).toBe(false);
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  test("updates the current user's account details and normalizes phone numbers", async () => {
    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "actor-id", role: "merchant" }),
    );

    const result = await updateOwnAccountAction({
      name: "Updated Name",
      phoneNumber: "09 999 999 999",
      address: "Updated address",
      age: "",
    });

    expect(result).toEqual({
      ok: true,
      message: "Account details saved.",
      user: {
        name: "Updated Name",
        phoneNumber: "09 999 999 999",
        address: "Updated address",
        age: undefined,
      },
    });
    expect(dbUpdateMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/settings");
  });

  test("maps form data through updateOwnAccountFormAction", async () => {
    const formData = new FormData();
    formData.set("name", "Updated Name");
    formData.set("phoneNumber", "09 999 999 999");
    formData.set("address", "Updated address");

    const result = await updateOwnAccountFormAction(
      {
        ok: false,
        message: null,
        values: { name: "", phoneNumber: "", address: "", age: "" },
      },
      formData,
    );

    expect(result).toEqual({
      ok: true,
      message: "Account details saved.",
      values: {
        name: "Updated Name",
        phoneNumber: "09 999 999 999",
        address: "Updated address",
        age: "",
      },
    });
  });

  test("restricts own bank-account creation to super admins", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ role: "office_admin" }));

    const result = await createOwnBankAccountAction(validBankAccountInput());

    expect(result).toEqual({
      ok: false,
      message: "Only super admins can manage bank accounts.",
    });
    expect(createBankAccountForUserMock).not.toHaveBeenCalled();
  });

  test("rejects invalid own bank-account input before persistence", async () => {
    const result = await createOwnBankAccountAction({
      bankName: "",
      accountHolderName: "",
      accountNumber: "123",
      isCompanyAccount: false,
      isPrimary: false,
    });

    expect(result.ok).toBe(false);
    expect(createBankAccountForUserMock).not.toHaveBeenCalled();
  });

  test("creates a company bank account for the current super admin", async () => {
    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "actor-id", role: "super_admin" }),
    );

    const result = await createOwnBankAccountAction(validBankAccountInput());

    expect(result.ok).toBe(true);
    expect(createBankAccountForUserMock).toHaveBeenCalledWith({
      userId: "actor-id",
      bankName: "KBZ Bank",
      accountHolderName: "Test Holder",
      accountNumber: "123456789",
      isCompanyAccount: true,
      isPrimary: true,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/settings");
  });

  test("returns not-found when editing a missing own bank account", async () => {
    updateBankAccountForUserMock.mockImplementation(async () => null as never);
    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "actor-id", role: "super_admin" }),
    );

    const result = await updateOwnBankAccountAction({
      id: "missing-bank-account-id",
      ...validBankAccountInput(),
    });

    expect(result).toEqual({
      ok: false,
      message: "Bank account was not found.",
    });
  });

  test("returns not-found when creating a bank account for a missing target user", async () => {
    getUserByIdMock.mockImplementation(async () => null as never);

    const result = await createUserBankAccountAction({
      userId: "missing-user-id",
      ...validBankAccountInput(),
    });

    expect(result).toEqual({
      ok: false,
      message: "User was not found.",
    });
    expect(createBankAccountForUserMock).not.toHaveBeenCalled();
  });

  test("rejects unauthorized managed bank-account updates", async () => {
    requireCurrentUserMock.mockResolvedValue(buildCurrentUser({ role: "office_admin" }));

    const result = await updateUserBankAccountAction({
      id: "bank-account-id",
      userId: "target-user-id",
      ...validBankAccountInput(),
    });

    expect(result).toEqual({
      ok: false,
      message: "Only super admins can manage bank accounts.",
    });
    expect(updateBankAccountForUserMock).not.toHaveBeenCalled();
  });

  test("updates managed user bank accounts and revalidates users", async () => {
    const result = await updateUserBankAccountAction({
      id: "bank-account-id",
      userId: "target-user-id",
      bankName: "AYA Bank",
      accountHolderName: "Updated Holder",
      accountNumber: "987654321",
      isCompanyAccount: false,
      isPrimary: false,
    });

    expect(result.ok).toBe(true);
    expect(updateBankAccountForUserMock).toHaveBeenCalledWith({
      id: "bank-account-id",
      userId: "target-user-id",
      bankName: "AYA Bank",
      accountHolderName: "Updated Holder",
      accountNumber: "987654321",
      isCompanyAccount: false,
      isPrimary: false,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/users");
  });
});

function validBankAccountInput() {
  return {
    bankName: "KBZ Bank",
    accountHolderName: "Test Holder",
    accountNumber: "123456789",
    isCompanyAccount: false,
    isPrimary: true,
  };
}
