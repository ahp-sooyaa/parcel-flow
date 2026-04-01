import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadGetCurrentUserContextWithStubbedHeader(rawHeader: string | null) {
  vi.resetModules();
  vi.stubEnv("AUTH_E2E_STUB_MODE", "1");

  const headersMock = vi
    .fn()
    .mockResolvedValue(
      new Headers(rawHeader ? { "x-parcel-flow-e2e-auth": rawHeader } : undefined),
    );
  const getClaimsMock = vi.fn();
  const findCurrentUserContextBySupabaseUserIdMock = vi.fn();

  vi.doMock("next/headers", () => ({
    headers: headersMock,
  }));

  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: vi.fn().mockResolvedValue({
      auth: {
        getClaims: getClaimsMock,
      },
    }),
  }));

  vi.doMock("@/features/auth/server/dal", () => ({
    findCurrentUserContextBySupabaseUserId: findCurrentUserContextBySupabaseUserIdMock,
  }));

  const mod = await import("@/features/auth/server/utils");

  return {
    getCurrentUserContext: mod.getCurrentUserContext,
    getClaimsMock,
    findCurrentUserContextBySupabaseUserIdMock,
  };
}

describe("getCurrentUserContext integration", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("preserves linked merchant id from the e2e auth header", async () => {
    const linkedMerchantId = "7f048ecf-7989-4f2e-b0a2-97f950f53ea4";
    const { getCurrentUserContext, getClaimsMock, findCurrentUserContextBySupabaseUserIdMock } =
      await loadGetCurrentUserContextWithStubbedHeader(
        JSON.stringify({
          authenticated: true,
          isActive: true,
          mustResetPassword: false,
          permissions: ["dashboard-page.view", "merchant.view"],
          linkedMerchantId,
          roleSlug: "merchant",
        }),
      );

    const result = await getCurrentUserContext();

    expect(result).toMatchObject({
      appUserId: "e2e-app-user",
      linkedMerchantId,
      role: {
        slug: "merchant",
      },
      permissions: ["dashboard-page.view", "merchant.view"],
    });
    expect(getClaimsMock).not.toHaveBeenCalled();
    expect(findCurrentUserContextBySupabaseUserIdMock).not.toHaveBeenCalled();
  });
});
