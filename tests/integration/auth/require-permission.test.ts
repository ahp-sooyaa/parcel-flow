import { describe, expect, it, vi } from "vitest";

async function loadRequirePermissionWithContext(context: {
  user: { id: string } | null;
  currentUserContext: {
    appUserId: string;
    supabaseUserId: string;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    role: {
      id: string;
      slug: "super_admin" | "office_admin" | "rider" | "merchant";
      label: string;
    };
    isActive: boolean;
    mustResetPassword: boolean;
    permissions: string[];
  } | null;
}) {
  const getUserMock = vi.fn().mockResolvedValue({ data: { user: context.user } });
  const findCurrentUserContextBySupabaseUserIdMock = vi
    .fn()
    .mockResolvedValue(context.currentUserContext);

  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn().mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    }),
  }));

  vi.doMock("@/features/auth/server/dal", () => ({
    findCurrentUserContextBySupabaseUserId: findCurrentUserContextBySupabaseUserIdMock,
  }));

  const mod = await import("@/features/auth/server/utils");

  return {
    requirePermission: mod.requirePermission,
    findCurrentUserContextBySupabaseUserIdMock,
  };
}

describe("requirePermission integration", () => {
  it("returns current user for valid active user with required permission", async () => {
    const currentUser = {
      appUserId: "app-1",
      supabaseUserId: "sup-1",
      fullName: "Admin",
      email: "admin@example.com",
      phoneNumber: null,
      role: { id: "role-1", slug: "super_admin" as const, label: "Super Admin" },
      isActive: true,
      mustResetPassword: false,
      permissions: ["dashboard-page.view"],
    };

    const { requirePermission } = await loadRequirePermissionWithContext({
      user: { id: "sup-1" },
      currentUserContext: currentUser,
    });

    await expect(requirePermission("dashboard-page.view")).resolves.toEqual(currentUser);
  });

  it("throws for unknown and unauthorized permission checks", async () => {
    const { requirePermission } = await loadRequirePermissionWithContext({
      user: null,
      currentUserContext: null,
    });

    await expect(requirePermission("unknown.permission" as never)).rejects.toThrow(
      "Unknown permission: unknown.permission",
    );
    await expect(requirePermission("dashboard-page.view")).rejects.toThrow("Unauthorized");
  });

  it("throws reset-required error when permission is outside reset allowlist", async () => {
    const { requirePermission } = await loadRequirePermissionWithContext({
      user: { id: "sup-1" },
      currentUserContext: {
        appUserId: "app-1",
        supabaseUserId: "sup-1",
        fullName: "Reset User",
        email: "reset@example.com",
        phoneNumber: null,
        role: { id: "role-2", slug: "rider", label: "Rider" },
        isActive: true,
        mustResetPassword: true,
        permissions: ["dashboard-page.view", "parcel-list.view"],
      },
    });

    await expect(requirePermission("parcel-list.view")).rejects.toThrow(
      "Password reset required before this action is allowed",
    );
  });
});
