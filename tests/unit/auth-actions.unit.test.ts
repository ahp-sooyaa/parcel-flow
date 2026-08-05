import { beforeEach, describe, expect, mock, test } from "bun:test";

import { buildSessionUser, buildUserListItem } from "../fixtures/builders";
import type { UserListItemDto } from "@/features/users/server/dto";

const getSessionMock = mock(async () => buildSessionUser({ id: "actor-id", role: "super_admin" }));
const getUserByIdMock = mock(
  async (): Promise<UserListItemDto | null> =>
    buildUserListItem({ id: "target-user-id", role: "merchant" }),
);
const canRegeneratePasswordMock = mock(() => true);
const generateTemporaryPasswordMock = mock(() => "TempPassword123!");
const changePasswordMock = mock(async () => undefined);
const setUserPasswordMock = mock(async () => undefined);
const headersMock = mock(async () => new Headers());
const revalidatePathMock = mock(() => undefined);
const updateTagMock = mock(() => undefined);
const revalidateTagMock = mock(() => undefined);
const dbWhereMock = mock(async () => undefined);
const dbSetMock = mock(() => ({ where: dbWhereMock }));
const dbUpdateMock = mock(() => ({ set: dbSetMock }));

void mock.module("@/features/users/server/dal", () => ({
  getUserById: getUserByIdMock,
}));

void mock.module("@/lib/permissions", () => ({
  canRegeneratePassword: canRegeneratePasswordMock,
}));

void mock.module("@/lib/password", () => ({
  generateTemporaryPassword: generateTemporaryPasswordMock,
}));

void mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
      changePassword: changePasswordMock,
      setUserPassword: setUserPasswordMock,
    },
  },
}));

void mock.module("next/headers", () => ({
  headers: headersMock,
}));

void mock.module("next/cache", () => ({
  cacheLife: () => undefined,
  cacheTag: () => undefined,
  revalidatePath: revalidatePathMock,
  updateTag: updateTagMock,
  revalidateTag: revalidateTagMock,
}));

void mock.module("@/db", () => ({
  db: {
    update: dbUpdateMock,
  },
}));

async function expectPromiseToRejectWith<T>(promise: Promise<T>, message: string) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) {
      expect(error.message).toBe(message);
      return;
    }

    throw error;
  }

  throw new Error(`Expected promise to reject with "${message}".`);
}

describe("auth server actions", async () => {
  const { regeneratePasswordAction, updateOwnPasswordAction, updateOwnPasswordFormAction } =
    await import("@/features/auth/server/actions");

  beforeEach(() => {
    getSessionMock.mockReset();
    getUserByIdMock.mockReset();
    canRegeneratePasswordMock.mockReset();
    generateTemporaryPasswordMock.mockReset();
    changePasswordMock.mockReset();
    setUserPasswordMock.mockReset();
    headersMock.mockReset();
    revalidatePathMock.mockReset();
    updateTagMock.mockReset();
    revalidateTagMock.mockReset();
    dbWhereMock.mockReset();
    dbSetMock.mockReset();
    dbUpdateMock.mockReset();

    getSessionMock.mockResolvedValue(buildSessionUser({ id: "actor-id", role: "super_admin" }));
    getUserByIdMock.mockResolvedValue(
      buildUserListItem({ id: "target-user-id", role: "merchant" }),
    );
    canRegeneratePasswordMock.mockReturnValue(true);
    generateTemporaryPasswordMock.mockReturnValue("TempPassword123!");
    changePasswordMock.mockResolvedValue(undefined);
    setUserPasswordMock.mockResolvedValue(undefined);
    headersMock.mockResolvedValue(new Headers());
    dbWhereMock.mockResolvedValue(undefined);
    dbSetMock.mockReturnValue({ where: dbWhereMock });
    dbUpdateMock.mockReturnValue({ set: dbSetMock });
  });

  test("rejects invalid own-password updates before calling auth", async () => {
    const result = await updateOwnPasswordAction({
      currentPassword: "current-password",
      newPassword: "short",
    });

    expect(result).toEqual({
      ok: false,
      message: "New password must be at least 8 characters.",
      fieldErrors: {
        newPassword: "New password must be at least 8 characters.",
      },
    });
    expect(changePasswordMock).not.toHaveBeenCalled();
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  test("rejects reusing the same password", async () => {
    const result = await updateOwnPasswordAction({
      currentPassword: "password123",
      newPassword: "password123",
    });

    expect(result).toEqual({
      ok: false,
      message: "New password must be different from current password.",
      fieldErrors: {
        newPassword: "New password must be different from current password.",
      },
    });
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  test("updates the password, clears must-reset, and revalidates settings", async () => {
    const result = await updateOwnPasswordAction({
      currentPassword: "current-password",
      newPassword: "new-password-123",
    });

    expect(result).toEqual({
      ok: true,
      message: "Password updated.",
    });
    expect(changePasswordMock).toHaveBeenCalledWith({
      body: {
        currentPassword: "current-password",
        newPassword: "new-password-123",
        revokeOtherSessions: true,
      },
      headers: expect.any(Headers),
    });
    expect(dbUpdateMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/settings");
  });

  test("maps form data through updateOwnPasswordFormAction", async () => {
    const formData = new FormData();
    formData.set("currentPassword", "current-password");
    formData.set("newPassword", "new-password-123");

    const result = await updateOwnPasswordFormAction({ ok: false, message: null }, formData);

    expect(result).toEqual({
      ok: true,
      message: "Password updated.",
    });
    expect(changePasswordMock).toHaveBeenCalledTimes(1);
  });

  test("rejects invalid password regeneration requests", async () => {
    await expectPromiseToRejectWith(
      regeneratePasswordAction({ targetUserId: "" }),
      "Too small: expected string to have >=1 characters",
    );
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  test("rejects password regeneration for missing users", async () => {
    getUserByIdMock.mockImplementation(async () => null);

    await expectPromiseToRejectWith(
      regeneratePasswordAction({ targetUserId: "missing-user-id" }),
      "User was not found.",
    );
    expect(setUserPasswordMock).not.toHaveBeenCalled();
  });

  test("rejects password regeneration without permission", async () => {
    canRegeneratePasswordMock.mockReturnValue(false);

    await expectPromiseToRejectWith(
      regeneratePasswordAction({ targetUserId: "target-user-id" }),
      "You do not have permission to regenerate this password.",
    );
    expect(setUserPasswordMock).not.toHaveBeenCalled();
  });

  test("regenerates a password, marks the user for reset, and revalidates users", async () => {
    const result = await regeneratePasswordAction({ targetUserId: "target-user-id" });

    expect(result).toEqual({
      temporaryPassword: "TempPassword123!",
      mustResetPassword: true,
    });
    expect(setUserPasswordMock).toHaveBeenCalledWith({
      body: {
        userId: "target-user-id",
        newPassword: "TempPassword123!",
      },
      headers: expect.any(Headers),
    });
    expect(dbUpdateMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/users");
  });
});
