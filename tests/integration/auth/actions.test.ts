import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
const createSupabaseServerClientMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/security/audit", () => ({
  logAuditEvent: logAuditEventMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock,
}));

describe("auth actions integration", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    signInWithPasswordMock.mockReset();
    signOutMock.mockReset();
    createSupabaseServerClientMock.mockReset();
    logAuditEventMock.mockReset();

    createSupabaseServerClientMock.mockResolvedValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
        signOut: signOutMock,
      },
    });
  });

  it("signInAction redirects to dashboard on successful credentials", async () => {
    const { signInAction } = await import("@/features/auth/server/actions");

    signInWithPasswordMock.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("email", "admin@example.com");
    formData.set("password", "StrongPassword123");

    await signInAction({ ok: false, message: "" }, formData);

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "StrongPassword123",
    });
    expect(logAuditEventMock).toHaveBeenCalledWith({ event: "auth.sign_in_success" });
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("signInAction handles validation and credential error branches", async () => {
    const { signInAction } = await import("@/features/auth/server/actions");

    const invalidForm = new FormData();
    invalidForm.set("email", "not-an-email");
    invalidForm.set("password", "short");

    const invalidResult = await signInAction({ ok: false, message: "" }, invalidForm);

    expect(invalidResult).toEqual({
      ok: false,
      message: "Please provide a valid email and password.",
    });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(logAuditEventMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();

    signInWithPasswordMock.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    const badCredentialForm = new FormData();
    badCredentialForm.set("email", "admin@example.com");
    badCredentialForm.set("password", "StrongPassword123");

    const credentialErrorResult = await signInAction({ ok: false, message: "" }, badCredentialForm);

    expect(credentialErrorResult).toEqual({
      ok: false,
      message: "Unable to sign in with those credentials.",
    });
    expect(logAuditEventMock).toHaveBeenCalledWith({ event: "auth.sign_in_failed" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("signOutAction signs out, logs audit event, and redirects to sign-in", async () => {
    const { signOutAction } = await import("@/features/auth/server/actions");

    signOutMock.mockResolvedValue({ error: null });

    await signOutAction();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(logAuditEventMock).toHaveBeenCalledWith({ event: "auth.sign_out" });
    expect(redirectMock).toHaveBeenCalledWith("/sign-in");
  });
});
