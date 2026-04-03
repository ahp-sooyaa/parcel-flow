import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const createTownshipMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const logAuditEventMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/features/auth/server/utils", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/townships/server/dal", () => ({
  createTownship: createTownshipMock,
}));

vi.mock("@/lib/security/audit", () => ({
  logAuditEvent: logAuditEventMock,
}));

describe("township actions integration", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    createTownshipMock.mockReset();
    revalidatePathMock.mockReset();
    logAuditEventMock.mockReset();
  });

  it("creates a township and revalidates dependent routes", async () => {
    const { createTownshipAction } = await import("@/features/townships/server/actions");

    requirePermissionMock.mockResolvedValue({ appUserId: "admin-1" });
    createTownshipMock.mockResolvedValue({ id: "township-1" });

    const formData = new FormData();
    formData.set("name", "Bahan");
    formData.set("isActive", "on");

    const result = await createTownshipAction({ ok: false, message: "" }, formData);

    expect(result).toEqual({
      ok: true,
      message: "Township created successfully.",
      townshipId: "township-1",
    });
    expect(requirePermissionMock).toHaveBeenCalledWith("township.create");
    expect(createTownshipMock).toHaveBeenCalledWith({ name: "Bahan", isActive: true });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/townships");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/users/create");
    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
  });
});
