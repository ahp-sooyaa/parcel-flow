import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.fn();
const getUserStatusGuardContextMock = vi.fn();
const countActiveSuperAdminUsersMock = vi.fn();

vi.mock("@/features/auth/server/utils", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/users/server/dal", async () => {
  const actual = await vi.importActual<typeof import("@/features/users/server/dal")>(
    "@/features/users/server/dal",
  );

  return {
    ...actual,
    getUserStatusGuardContext: getUserStatusGuardContextMock,
    countActiveSuperAdminUsers: countActiveSuperAdminUsersMock,
  };
});

describe("users server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid admin user profile edits before touching storage", async () => {
    requirePermissionMock.mockResolvedValue({
      appUserId: "admin-1",
      role: { slug: "super_admin" },
      permissions: ["user.update"],
    });

    const { updateUserProfileAction } = await import("@/features/users/server/actions");
    const formData = new FormData();
    formData.set("userId", "not-a-uuid");
    formData.set("fullName", "A");

    const result = await updateUserProfileAction({ ok: true, message: "" }, formData);

    expect(result).toEqual({
      ok: false,
      message: "Please provide valid user profile data.",
    });
  });

  it("rejects delete when user id is invalid", async () => {
    requirePermissionMock.mockResolvedValue({
      appUserId: "admin-1",
      role: { slug: "super_admin" },
      permissions: ["user.delete"],
    });

    const { softDeleteUserAction } = await import("@/features/users/server/actions");
    const formData = new FormData();
    formData.set("userId", "not-a-uuid");

    const result = await softDeleteUserAction({ ok: true, message: "" }, formData);

    expect(result).toEqual({
      ok: false,
      message: "User id is required.",
    });
  });

  it("keeps soft delete restricted to super admin even if permission lookup resolves", async () => {
    requirePermissionMock.mockResolvedValue({
      appUserId: "office-admin-1",
      role: { slug: "office_admin" },
      permissions: ["user.delete"],
    });

    const { softDeleteUserAction } = await import("@/features/users/server/actions");
    const formData = new FormData();
    formData.set("userId", "7f048ecf-7989-4f2e-b0a2-97f950f53ea4");

    const result = await softDeleteUserAction({ ok: true, message: "" }, formData);

    expect(result).toEqual({
      ok: false,
      message: "Only super admin can delete users.",
    });
  });

  it("rejects self soft delete for super admin", async () => {
    requirePermissionMock.mockResolvedValue({
      appUserId: "super-admin-1",
      role: { slug: "super_admin" },
      permissions: ["user.delete"],
    });
    getUserStatusGuardContextMock.mockResolvedValue({
      id: "super-admin-1",
      isActive: true,
      roleSlug: "super_admin",
    });

    const { softDeleteUserAction } = await import("@/features/users/server/actions");
    const formData = new FormData();
    formData.set("userId", "7f048ecf-7989-4f2e-b0a2-97f950f53ea4");

    const result = await softDeleteUserAction({ ok: true, message: "" }, formData);

    expect(result).toEqual({
      ok: false,
      message: "You cannot delete your own account.",
    });
  });

  it("rejects soft delete for the last active super admin", async () => {
    requirePermissionMock.mockResolvedValue({
      appUserId: "super-admin-1",
      role: { slug: "super_admin" },
      permissions: ["user.delete"],
    });
    getUserStatusGuardContextMock.mockResolvedValue({
      id: "super-admin-2",
      isActive: true,
      roleSlug: "super_admin",
    });
    countActiveSuperAdminUsersMock.mockResolvedValue(1);

    const { softDeleteUserAction } = await import("@/features/users/server/actions");
    const formData = new FormData();
    formData.set("userId", "7f048ecf-7989-4f2e-b0a2-97f950f53ea4");

    const result = await softDeleteUserAction({ ok: true, message: "" }, formData);

    expect(result).toEqual({
      ok: false,
      message: "Cannot delete the last active super admin account.",
    });
  });
});
