import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const findRoleBySlugMock = vi.hoisted(() => vi.fn());
const findAppUserByIdMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const generateStrongPasswordMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());

const dbInsertMock = vi.hoisted(() => vi.fn());
const dbUpdateMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/features/auth/server/utils", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/auth/server/dal", () => ({
  findRoleBySlug: findRoleBySlugMock,
  findAppUserById: findAppUserByIdMock,
}));

vi.mock("@/features/users/server/dal", () => ({
  countActiveSuperAdminUsers: vi.fn(),
  getUserStatusGuardContext: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock,
}));

vi.mock("@/lib/security/password", () => ({
  generateStrongPassword: generateStrongPasswordMock,
}));

vi.mock("@/lib/security/audit", () => ({
  logAuditEvent: logAuditEventMock,
}));

vi.mock("@/db", () => ({
  db: {
    insert: dbInsertMock,
    update: dbUpdateMock,
  },
}));

describe("users actions integration", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    findRoleBySlugMock.mockReset();
    findAppUserByIdMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
    generateStrongPasswordMock.mockReset();
    revalidatePathMock.mockReset();
    logAuditEventMock.mockReset();
    dbInsertMock.mockReset();
    dbUpdateMock.mockReset();
  });

  it("createUserAction handles permission and validation failures without side effects", async () => {
    const { createUserAction } = await import("@/features/users/server/actions");

    requirePermissionMock.mockRejectedValue(new Error("Forbidden"));

    const formData = new FormData();
    formData.set("fullName", "Aung Htet");
    formData.set("email", "aung@example.com");
    formData.set("role", "office_admin");
    formData.set("isActive", "on");

    const forbiddenResult = await createUserAction({ ok: false, message: "" }, formData);

    expect(forbiddenResult).toEqual({ ok: false, message: "Forbidden" });
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();

    requirePermissionMock.mockResolvedValue({
      appUserId: "app-1",
      role: { slug: "super_admin" },
    });

    const invalidFormData = new FormData();
    invalidFormData.set("fullName", "");
    invalidFormData.set("email", "bad-email");
    invalidFormData.set("role", "invalid-role");

    const validationResult = await createUserAction({ ok: false, message: "" }, invalidFormData);

    expect(validationResult).toEqual({ ok: false, message: "Please provide valid user details." });
    expect(findRoleBySlugMock).not.toHaveBeenCalled();
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });
});
