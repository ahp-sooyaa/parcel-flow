import { beforeEach, describe, expect, mock, test } from "bun:test";

import { buildCurrentUser, buildUserListItem } from "../fixtures/builders";

const requireCurrentUserMock = mock(async () =>
  buildCurrentUser({ id: "actor-id", role: "super_admin" }),
);
const getUserByIdMock = mock(async () =>
  buildUserListItem({ id: "target-user-id", role: "merchant" }),
);
const canRegeneratePasswordMock = mock(() => true);
const generateTemporaryPasswordMock = mock(() => "TempPassword123!");
const changePasswordMock = mock(async () => undefined);
const setUserPasswordMock = mock(async () => undefined);
const headersMock = mock(async () => new Headers());
const revalidatePathMock = mock(() => undefined);
const dbWhereMock = mock(async () => undefined);
const dbSetMock = mock(() => ({ where: dbWhereMock }));
const dbUpdateMock = mock(() => ({ set: dbSetMock }));

void mock.module("@/lib/session", () => ({
  requireCurrentUser: requireCurrentUserMock,
}));

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
      changePassword: changePasswordMock,
      setUserPassword: setUserPasswordMock,
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

describe("auth server actions", async () => {
  const { regeneratePasswordAction, updateOwnPasswordAction, updateOwnPasswordFormAction } =
    await import("@/features/auth/server/actions");

  beforeEach(() => {
    requireCurrentUserMock.mockReset();
    getUserByIdMock.mockReset();
    canRegeneratePasswordMock.mockReset();
    generateTemporaryPasswordMock.mockReset();
    changePasswordMock.mockReset();
    setUserPasswordMock.mockReset();
    headersMock.mockReset();
    revalidatePathMock.mockReset();
    dbWhereMock.mockReset();
    dbSetMock.mockReset();
    dbUpdateMock.mockReset();

    requireCurrentUserMock.mockResolvedValue(
      buildCurrentUser({ id: "actor-id", role: "super_admin" }),
    );
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
    await expect(regeneratePasswordAction({ targetUserId: "" })).rejects.toThrow(
      "Too small: expected string to have >=1 characters",
    );
    expect(getUserByIdMock).not.toHaveBeenCalled();
  });

  test("rejects password regeneration for missing users", async () => {
    getUserByIdMock.mockImplementation(async () => null as never);

    await expect(regeneratePasswordAction({ targetUserId: "missing-user-id" })).rejects.toThrow(
      "User was not found.",
    );
    expect(setUserPasswordMock).not.toHaveBeenCalled();
  });

  test("rejects password regeneration without permission", async () => {
    canRegeneratePasswordMock.mockReturnValue(false);

    await expect(regeneratePasswordAction({ targetUserId: "target-user-id" })).rejects.toThrow(
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
