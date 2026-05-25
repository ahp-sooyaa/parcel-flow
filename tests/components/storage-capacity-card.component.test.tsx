import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type {
  RefreshStorageStatsActionResult,
  StorageStatsCardDto,
} from "@/features/dashboard/server/dto";

const toastSuccessMock = mock(() => undefined);
const toastErrorMock = mock(() => undefined);
const refreshMock = mock(() => undefined);
const refreshStorageStatsActionMock = mock(
  async (): Promise<RefreshStorageStatsActionResult> => ({
    ok: true,
    message: "Storage stats refreshed.",
    stats: buildStorageStats({
      rows: [
        {
          id: "supabase-database",
          label: "Supabase DB",
          detail: "Database storage",
          usedBytes: 2_048,
          referenceBytes: 4_096,
          percentUsed: 50,
          fetchStatus: "ready",
          statusMessage: null,
        },
        {
          id: "cloudflare-r2",
          label: "Cloudflare R2",
          detail: "Total storage",
          usedBytes: 5_120,
          referenceBytes: 10 * 1024 * 1024 * 1024,
          percentUsed: 0,
          fetchStatus: "ready",
          statusMessage: null,
        },
      ],
    }),
  }),
);

void mock.module("@/lib/client-navigation", () => ({
  useAppRouter: () => ({
    refresh: refreshMock,
  }),
}));

void mock.module("@/features/dashboard/server/actions", () => ({
  refreshStorageStatsAction: refreshStorageStatsActionMock,
}));

void mock.module("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe("StorageCapacityCard", async () => {
  const { StorageCapacityCard } =
    await import("@/features/dashboard/components/storage-capacity-card");

  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    refreshMock.mockReset();
    refreshStorageStatsActionMock.mockReset();
    refreshStorageStatsActionMock.mockResolvedValue({
      ok: true,
      message: "Storage stats refreshed.",
      stats: buildStorageStats({
        rows: [
          {
            id: "supabase-database",
            label: "Supabase DB",
            detail: "Database storage",
            usedBytes: 2_048,
            referenceBytes: 4_096,
            percentUsed: 50,
            fetchStatus: "ready",
            statusMessage: null,
          },
          {
            id: "cloudflare-r2",
            label: "Cloudflare R2",
            detail: "Total storage",
            usedBytes: 5_120,
            referenceBytes: 10 * 1024 * 1024 * 1024,
            percentUsed: 0,
            fetchStatus: "ready",
            statusMessage: null,
          },
        ],
      }),
    });
  });

  test("renders both storage rows", () => {
    render(<StorageCapacityCard initialStats={buildStorageStats()} />);

    expect(screen.getByText("Supabase DB")).toBeTruthy();
    expect(screen.getByText("Cloudflare R2")).toBeTruthy();
  });

  test("refreshes stats and refreshes the router on success", async () => {
    const user = userEvent.setup();
    render(<StorageCapacityCard initialStats={buildStorageStats()} />);

    await user.click(screen.getByRole("button", { name: "Refresh storage stats" }));

    await waitFor(() => {
      expect(refreshStorageStatsActionMock).toHaveBeenCalledTimes(1);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Storage stats refreshed.", {
      description: undefined,
      id: "success:Storage stats refreshed.:",
      position: "top-center",
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  test("shows unavailable state and does not refresh the router on failed refresh", async () => {
    refreshStorageStatsActionMock.mockResolvedValue({
      ok: false,
      message: "Cloudflare R2 could not be refreshed.",
      stats: buildStorageStats({
        rows: [
          {
            id: "supabase-database",
            label: "Supabase DB",
            detail: "Database storage",
            usedBytes: 2_048,
            referenceBytes: 4_096,
            percentUsed: 50,
            fetchStatus: "ready",
            statusMessage: null,
          },
          {
            id: "cloudflare-r2",
            label: "Cloudflare R2",
            detail: "Total storage",
            usedBytes: null,
            referenceBytes: 10 * 1024 * 1024 * 1024,
            percentUsed: null,
            fetchStatus: "unavailable",
            statusMessage: "Cloudflare R2 storage could not be loaded.",
          },
        ],
      }),
    });

    const user = userEvent.setup();
    render(<StorageCapacityCard initialStats={buildStorageStats()} />);

    await user.click(screen.getByRole("button", { name: "Refresh storage stats" }));

    expect(toastErrorMock).toHaveBeenCalledWith("Cloudflare R2 could not be refreshed.", {
      description: undefined,
      id: "error:Cloudflare R2 could not be refreshed.:",
      position: "top-center",
    });
    expect(await screen.findByText("Unavailable")).toBeTruthy();
    expect(refreshMock).not.toHaveBeenCalled();
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
        referenceBytes: 10 * 1024 * 1024 * 1024,
        percentUsed: 0,
        fetchStatus: "ready",
        statusMessage: null,
      },
    ],
    refreshedAt: "2026-05-24T00:00:00.000Z",
    ...overrides,
  };
}
