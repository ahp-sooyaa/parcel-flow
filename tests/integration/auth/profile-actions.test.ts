import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCurrentUserMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());
const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/features/auth/server/utils", () => ({
  requireCurrentUser: requireCurrentUserMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

vi.mock("@/lib/security/audit", () => ({
  logAuditEvent: logAuditEventMock,
}));

vi.mock("@/db", () => ({
  db: {
    update: updateUserMock,
  },
}));

describe("profile actions integration", () => {
  beforeEach(() => {
    requireCurrentUserMock.mockReset();
    updateUserMock.mockReset();
    createSupabaseServerClientMock.mockReset();
    logAuditEventMock.mockReset();
    revalidatePathMock.mockReset();
  });

  it("updateOwnProfileAction returns explicit error when current-user check fails", async () => {
    const { updateOwnProfileAction } = await import("@/features/profile/server/actions");

    requireCurrentUserMock.mockRejectedValue(new Error("Unauthorized"));

    const formData = new FormData();
    formData.set("fullName", "User Name");
    formData.set("phoneNumber", "0999999999");

    const result = await updateOwnProfileAction({ ok: false, message: "" }, formData);

    expect(result).toEqual({ ok: false, message: "Unauthorized" });
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(logAuditEventMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("changeOwnPasswordAction validates input and maps upstream supabase errors", async () => {
    const { changeOwnPasswordAction } = await import("@/features/profile/server/actions");

    requireCurrentUserMock.mockResolvedValue({
      appUserId: "app-1",
      role: { slug: "office_admin" },
    });

    const formData = new FormData();
    formData.set("password", "short");
    formData.set("confirmPassword", "short");

    const invalidResult = await changeOwnPasswordAction({ ok: false, message: "" }, formData);

    expect(invalidResult.ok).toBe(false);
    expect(invalidResult.message).toContain("at least 12");
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(logAuditEventMock).not.toHaveBeenCalled();

    const updateUserBySupabaseMock = vi.fn().mockResolvedValue({
      error: { message: "Password is too weak for security purposes" },
    });

    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        updateUser: updateUserBySupabaseMock,
      },
    });

    const retryFormData = new FormData();
    retryFormData.set("password", "StrongPassword123");
    retryFormData.set("confirmPassword", "StrongPassword123");

    const weakPasswordResult = await changeOwnPasswordAction(
      { ok: false, message: "" },
      retryFormData,
    );

    expect(weakPasswordResult).toEqual({
      ok: false,
      message:
        "Your new password is too weak. Use a stronger password with at least 12 characters.",
    });
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });
});
