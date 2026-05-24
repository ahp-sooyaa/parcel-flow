export type StorageMetricStatus = "ready" | "unavailable";

export type StorageMetricRowDto = {
  id: "supabase-database" | "cloudflare-r2";
  label: string;
  detail: string;
  usedBytes: number | null;
  referenceBytes: number | null;
  percentUsed: number | null;
  fetchStatus: StorageMetricStatus;
  statusMessage: string | null;
};

export type StorageStatsCardDto = {
  rows: StorageMetricRowDto[];
  refreshedAt: string;
};

export type RefreshStorageStatsActionResult =
  | {
      ok: true;
      message: string;
      stats: StorageStatsCardDto;
    }
  | {
      ok: false;
      message: string;
      stats?: StorageStatsCardDto;
    };
