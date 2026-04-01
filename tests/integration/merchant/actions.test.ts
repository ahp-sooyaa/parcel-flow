import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const findAppUserByIdMock = vi.hoisted(() => vi.fn());
const findMerchantByLinkedAppUserIdMock = vi.hoisted(() => vi.fn());
const createMerchantMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/features/auth/server/utils", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/auth/server/dal", () => ({
  findAppUserById: findAppUserByIdMock,
}));

vi.mock("@/features/merchant/server/dal", () => ({
  createMerchant: createMerchantMock,
  findMerchantByLinkedAppUserId: findMerchantByLinkedAppUserIdMock,
}));

vi.mock("@/lib/security/audit", () => ({
  logAuditEvent: logAuditEventMock,
}));

describe("merchant actions integration", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    findAppUserByIdMock.mockReset();
    findMerchantByLinkedAppUserIdMock.mockReset();
    createMerchantMock.mockReset();
    revalidatePathMock.mockReset();
    logAuditEventMock.mockReset();
  });

  it("handles permission and validation failures without side effects", async () => {
    const { createMerchantAction } = await import("@/features/merchant/server/actions");

    requirePermissionMock.mockRejectedValue(new Error("Forbidden"));

    const forbiddenForm = new FormData();
    forbiddenForm.set("name", "Golden Shop");
    forbiddenForm.set("address", "No 2, Main Street");
    forbiddenForm.set("township", "Bahan");

    const forbiddenResult = await createMerchantAction({ ok: false, message: "" }, forbiddenForm);

    expect(forbiddenResult).toEqual({ ok: false, message: "Forbidden" });
    expect(createMerchantMock).not.toHaveBeenCalled();

    requirePermissionMock.mockResolvedValue({ appUserId: "app-1" });

    const invalidForm = new FormData();
    invalidForm.set("name", "");
    invalidForm.set("address", "");
    invalidForm.set("township", "Invalid");

    const validationResult = await createMerchantAction({ ok: false, message: "" }, invalidForm);

    expect(validationResult).toEqual({
      ok: false,
      message: "Please provide valid merchant details.",
    });
    expect(findAppUserByIdMock).not.toHaveBeenCalled();
    expect(createMerchantMock).not.toHaveBeenCalled();
  });

  it("returns validation message when linked app user is invalid or already linked", async () => {
    const { createMerchantAction } = await import("@/features/merchant/server/actions");

    requirePermissionMock.mockResolvedValue({ appUserId: "app-1" });

    const formData = new FormData();
    formData.set("name", "Golden Shop");
    formData.set("address", "No 2, Main Street");
    formData.set("township", "Bahan");
    formData.set("linkedAppUserId", "7f048ecf-7989-4f2e-b0a2-97f950f53ea4");

    findAppUserByIdMock.mockResolvedValue(null);

    const missingUserResult = await createMerchantAction({ ok: false, message: "" }, formData);

    expect(missingUserResult).toEqual({ ok: false, message: "Linked app user was not found." });

    findAppUserByIdMock.mockResolvedValue({ id: "user-1" });
    findMerchantByLinkedAppUserIdMock.mockResolvedValue({ id: "merchant-1" });

    const alreadyLinkedResult = await createMerchantAction({ ok: false, message: "" }, formData);

    expect(alreadyLinkedResult).toEqual({
      ok: false,
      message: "Linked app user is already connected to another merchant.",
    });
    expect(createMerchantMock).not.toHaveBeenCalled();
  });

  it("creates merchant with allowlisted fields and revalidates merchant list", async () => {
    const { createMerchantAction } = await import("@/features/merchant/server/actions");

    requirePermissionMock.mockResolvedValue({ appUserId: "app-1" });
    findAppUserByIdMock.mockResolvedValue({ id: "user-1" });
    findMerchantByLinkedAppUserIdMock.mockResolvedValue(null);
    createMerchantMock.mockResolvedValue({ id: "merchant-1" });

    const formData = new FormData();
    formData.set("name", "Golden Shop");
    formData.set("phoneNumber", "09420000000");
    formData.set("address", "No 2, Main Street");
    formData.set("township", "Bahan");
    formData.set("notes", "VIP sender");
    formData.set("linkedAppUserId", "7f048ecf-7989-4f2e-b0a2-97f950f53ea4");
    formData.set("unexpectedField", "should-not-be-used");

    const result = await createMerchantAction({ ok: false, message: "" }, formData);

    expect(result).toEqual({
      ok: true,
      message: "Merchant profile created successfully.",
      merchantId: "merchant-1",
    });

    expect(createMerchantMock).toHaveBeenCalledWith({
      name: "Golden Shop",
      phoneNumber: "09420000000",
      address: "No 2, Main Street",
      township: "Bahan",
      notes: "VIP sender",
      linkedAppUserId: "7f048ecf-7989-4f2e-b0a2-97f950f53ea4",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/merchants");
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });
});
