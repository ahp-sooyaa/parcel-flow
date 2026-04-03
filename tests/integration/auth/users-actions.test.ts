import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const findRoleBySlugMock = vi.hoisted(() => vi.fn());
const findAppUserByIdMock = vi.hoisted(() => vi.fn());
const findTownshipByIdMock = vi.hoisted(() => vi.fn());
const createMerchantProfileMock = vi.hoisted(() => vi.fn());
const createRiderProfileMock = vi.hoisted(() => vi.fn());
const createSupabaseAdminClientMock = vi.hoisted(() => vi.fn());
const generateStrongPasswordMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());

const dbInsertMock = vi.hoisted(() => vi.fn());
const dbUpdateMock = vi.hoisted(() => vi.fn());
const dbDeleteMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/features/townships/server/dal", () => ({
  findTownshipById: findTownshipByIdMock,
}));

vi.mock("@/features/merchant/server/dal", () => ({
  createMerchantProfile: createMerchantProfileMock,
}));

vi.mock("@/features/rider/server/dal", () => ({
  createRiderProfile: createRiderProfileMock,
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
    delete: dbDeleteMock,
  },
}));

describe("users actions integration", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    findRoleBySlugMock.mockReset();
    findAppUserByIdMock.mockReset();
    findTownshipByIdMock.mockReset();
    createMerchantProfileMock.mockReset();
    createRiderProfileMock.mockReset();
    createSupabaseAdminClientMock.mockReset();
    generateStrongPasswordMock.mockReset();
    revalidatePathMock.mockReset();
    logAuditEventMock.mockReset();
    dbInsertMock.mockReset();
    dbUpdateMock.mockReset();
    dbDeleteMock.mockReset();
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

  it("createUserAction provisions merchant and rider profiles with township-backed fields", async () => {
    const { createUserAction } = await import("@/features/users/server/actions");
    const townshipId = "7f048ecf-7989-4f2e-b0a2-97f950f53ea4";

    requirePermissionMock.mockResolvedValue({
      appUserId: "admin-1",
      role: { slug: "super_admin" },
    });
    findRoleBySlugMock.mockResolvedValue({ id: "role-merchant" });
    findTownshipByIdMock.mockResolvedValue({ id: townshipId, name: "Bahan", isActive: true });
    generateStrongPasswordMock.mockReturnValue("temp-password");

    const deleteUserMock = vi.fn().mockResolvedValue({});
    const createUserMock = vi.fn().mockResolvedValue({
      data: { user: { id: "supabase-user-1" } },
      error: null,
    });
    createSupabaseAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          createUser: createUserMock,
          deleteUser: deleteUserMock,
        },
      },
    });

    const returningMock = vi.fn().mockResolvedValue([{ id: "app-user-1" }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    dbInsertMock.mockReturnValue({ values: valuesMock });

    createMerchantProfileMock.mockResolvedValue({ id: "app-user-1" });

    const merchantForm = new FormData();
    merchantForm.set("fullName", "Merchant Admin");
    merchantForm.set("email", "merchant@example.com");
    merchantForm.set("phoneNumber", "091111111");
    merchantForm.set("role", "merchant");
    merchantForm.set("isActive", "on");
    merchantForm.set("merchantPickupTownshipId", townshipId);
    merchantForm.set("merchantDefaultPickupAddress", "No 1, Merchant Road");

    const merchantResult = await createUserAction({ ok: false, message: "" }, merchantForm);

    expect(merchantResult).toEqual({
      ok: true,
      message: "User created. Temporary password is shown once below.",
      temporaryPassword: "temp-password",
    });
    expect(createMerchantProfileMock).toHaveBeenCalledWith({
      appUserId: "app-user-1",
      shopName: "Merchant Admin",
      pickupTownshipId: townshipId,
      defaultPickupAddress: "No 1, Merchant Road",
      notes: null,
    });

    findRoleBySlugMock.mockResolvedValue({ id: "role-rider" });
    createRiderProfileMock.mockResolvedValue({ id: "app-user-2" });
    returningMock.mockResolvedValueOnce([{ id: "app-user-2" }]);

    const riderForm = new FormData();
    riderForm.set("fullName", "Rider Admin");
    riderForm.set("email", "rider@example.com");
    riderForm.set("role", "rider");
    riderForm.set("isActive", "on");
    riderForm.set("riderTownshipId", townshipId);

    const riderResult = await createUserAction({ ok: false, message: "" }, riderForm);

    expect(riderResult.ok).toBe(true);
    expect(createRiderProfileMock).toHaveBeenCalledWith({
      appUserId: "app-user-2",
      townshipId: townshipId,
      vehicleType: "bike",
      licensePlate: null,
      isActive: true,
      notes: null,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/users");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/merchants");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/riders");
    expect(logAuditEventMock).toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("createUserAction rejects inactive townships for profile-backed roles", async () => {
    const { createUserAction } = await import("@/features/users/server/actions");
    const townshipId = "7f048ecf-7989-4f2e-b0a2-97f950f53ea4";

    requirePermissionMock.mockResolvedValue({
      appUserId: "admin-1",
      role: { slug: "super_admin" },
    });
    findRoleBySlugMock.mockResolvedValue({ id: "role-merchant" });
    findTownshipByIdMock.mockResolvedValue({ id: townshipId, name: "Bahan", isActive: false });

    const formData = new FormData();
    formData.set("fullName", "Merchant Admin");
    formData.set("email", "merchant@example.com");
    formData.set("role", "merchant");
    formData.set("isActive", "on");
    formData.set("merchantPickupTownshipId", townshipId);

    const result = await createUserAction({ ok: false, message: "" }, formData);

    expect(result).toEqual({
      ok: false,
      message: "Selected merchant township was not found.",
    });
    expect(createSupabaseAdminClientMock).not.toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();
    expect(createMerchantProfileMock).not.toHaveBeenCalled();
  });

  it("createUserAction preserves an unchecked rider active flag", async () => {
    const { createUserAction } = await import("@/features/users/server/actions");
    const townshipId = "7f048ecf-7989-4f2e-b0a2-97f950f53ea4";

    requirePermissionMock.mockResolvedValue({
      appUserId: "admin-1",
      role: { slug: "super_admin" },
    });
    findRoleBySlugMock.mockResolvedValue({ id: "role-rider" });
    findTownshipByIdMock.mockResolvedValue({ id: townshipId, name: "Bahan", isActive: true });
    generateStrongPasswordMock.mockReturnValue("temp-password");

    const deleteUserMock = vi.fn().mockResolvedValue({});
    const createUserMock = vi.fn().mockResolvedValue({
      data: { user: { id: "supabase-user-3" } },
      error: null,
    });
    createSupabaseAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          createUser: createUserMock,
          deleteUser: deleteUserMock,
        },
      },
    });

    const returningMock = vi.fn().mockResolvedValue([{ id: "app-user-3" }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    dbInsertMock.mockReturnValue({ values: valuesMock });
    createRiderProfileMock.mockResolvedValue({ id: "app-user-3" });

    const riderForm = new FormData();
    riderForm.set("fullName", "Inactive Rider");
    riderForm.set("email", "inactive-rider@example.com");
    riderForm.set("role", "rider");
    riderForm.set("isActive", "on");
    riderForm.set("riderTownshipId", townshipId);

    const result = await createUserAction({ ok: false, message: "" }, riderForm);

    expect(result.ok).toBe(true);
    expect(createRiderProfileMock).toHaveBeenCalledWith({
      appUserId: "app-user-3",
      townshipId,
      vehicleType: "bike",
      licensePlate: null,
      isActive: false,
      notes: null,
    });
    expect(deleteUserMock).not.toHaveBeenCalled();
  });
});
