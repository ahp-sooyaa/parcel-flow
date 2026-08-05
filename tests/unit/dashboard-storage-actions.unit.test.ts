import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { StorageStatsCardDto } from "@/features/dashboard/server/dto";

import { buildSessionUser } from "../fixtures/builders";

const readyStats = buildStorageStats();
const partiallyUnavailableStats = buildStorageStats({
  rows: [
    buildStorageStats().rows[0],
    {
      id: "cloudflare-r2",
      label: "Cloudflare R2",
      detail: "Total storage",
      usedBytes: null,
      referenceBytes: 10_240,
      percentUsed: null,
      fetchStatus: "unavailable",
      statusMessage: "Cloudflare R2 storage could not be loaded.",
    },
  ],
});

const getSessionMock = mock(async () => buildSessionUser({ role: "super_admin" }));
const headersMock = mock(async () => new Headers());
const getStorageStatsMock = mock(async () => readyStats);
const revalidatePathMock = mock(() => undefined);
const updateTagMock = mock(() => undefined);
const revalidateTagMock = mock(() => undefined);

void mock.module("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

void mock.module("next/headers", () => ({
  headers: headersMock,
}));

void mock.module("@/features/dashboard/server/dal", () => ({
  getStorageStats: getStorageStatsMock,
}));

void mock.module("next/cache", () => ({
  cacheLife: () => undefined,
  cacheTag: () => undefined,
  revalidatePath: revalidatePathMock,
  updateTag: updateTagMock,
  revalidateTag: revalidateTagMock,
}));

describe("dashboard storage actions", async () => {
  const { refreshStorageStatsAction } = await import("@/features/dashboard/server/actions");

  beforeEach(() => {
    getSessionMock.mockReset();
    headersMock.mockReset();
    getStorageStatsMock.mockReset();
    revalidatePathMock.mockReset();
    updateTagMock.mockReset();
    revalidateTagMock.mockReset();

    getSessionMock.mockResolvedValue(buildSessionUser({ role: "super_admin" }));
    headersMock.mockResolvedValue(new Headers());
    getStorageStatsMock.mockResolvedValue(readyStats);
  });

  test("rejects refresh from non-super-admin users", async () => {
    getSessionMock.mockResolvedValue(buildSessionUser({ role: "office_admin" }));

    const result = await refreshStorageStatsAction();

    expect(result).toEqual({
      ok: false,
      message: "You do not have permission to view storage stats.",
    });
    expect(getStorageStatsMock).not.toHaveBeenCalled();
  });

  test("revalidates dashboard after a successful refresh", async () => {
    const result = await refreshStorageStatsAction();

    expect(result.ok).toBe(true);
    expect(getStorageStatsMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
  });

  test("returns refreshed stats with an error message when some providers are unavailable", async () => {
    getStorageStatsMock.mockResolvedValue(partiallyUnavailableStats);

    const result = await refreshStorageStatsAction();

    expect(result).toEqual({
      ok: false,
      message: "Cloudflare R2 could not be refreshed.",
      stats: partiallyUnavailableStats,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
  });
});

function buildStorageStats(overrides: Partial<StorageStatsCardDto> = {}): StorageStatsCardDto {
  return {
    rows: [
      {
        id: "supabase-database",
        label: "Supabase DB",
        detail: "Database storage",
        usedBytes: 1_024,
        referenceBytes: 2_048,
        percentUsed: 50,
        fetchStatus: "ready",
        statusMessage: null,
      },
      {
        id: "cloudflare-r2",
        label: "Cloudflare R2",
        detail: "Total storage",
        usedBytes: 2_048,
        referenceBytes: 10_240,
        percentUsed: 20,
        fetchStatus: "ready",
        statusMessage: null,
      },
    ],
    refreshedAt: "2026-05-24T00:00:00.000Z",
    ...overrides,
  };
}
