"use client";

import { useState, useTransition } from "react";
import { Database, HardDriveUpload, RefreshCw } from "lucide-react";

import { FormBanner, type FormMessageState } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { refreshStorageStatsAction } from "@/features/dashboard/server/actions";
import type { StorageMetricRowDto, StorageStatsCardDto } from "@/features/dashboard/server/dto";
import { useAppRouter } from "@/lib/client-navigation";
import { formatDate, formatFileSize } from "@/lib/format";

type StorageCapacityCardProps = Readonly<{
  initialStats: StorageStatsCardDto;
}>;

export function StorageCapacityCard({ initialStats }: StorageCapacityCardProps) {
  const router = useAppRouter();
  const [isPending, startTransition] = useTransition();
  const [stats, setStats] = useState(initialStats);
  const [messageState, setMessageState] = useState<FormMessageState | null>(null);

  function refreshStats() {
    setMessageState(null);

    startTransition(async () => {
      const result = await refreshStorageStatsAction();

      if (result.stats) {
        setStats(result.stats);
      }

      setMessageState({
        kind: result.ok ? "success" : "error",
        message: result.message,
      });

      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <Card size="sm" className="gap-4 border-[#e6ddd5] bg-white">
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {stats.rows.map((row) => (
            <StorageMetricRow key={row.id} row={row} />
          ))}
        </div>
        <div className="space-y-2">
          {messageState ? <FormBanner state={messageState} /> : null}
          <div className="flex justify-between">
            <p className="text-[11px] text-[#8b8782]">
              Last checked {formatDate(stats.refreshedAt)}
            </p>
            <Button
              type="button"
              size="icon-xs"
              variant="outline"
              aria-label="Refresh storage stats"
              onClick={refreshStats}
              disabled={isPending}
            >
              <RefreshCw className={isPending ? "animate-spin" : undefined} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StorageMetricRow({ row }: Readonly<{ row: StorageMetricRowDto }>) {
  const Icon = row.id === "supabase-database" ? Database : HardDriveUpload;
  const usedLabel = formatFileSize(row.usedBytes);
  const referenceLabel = formatFileSize(row.referenceBytes);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="size-3.5 text-[#6d6761]" />
            <p className="text-sm font-medium text-[#292827]">{row.label}</p>
          </div>
        </div>
        <div className="text-right">
          {row.fetchStatus === "ready" ? (
            <p className="text-xs font-medium text-[#292827]">
              {usedLabel} / {referenceLabel}
            </p>
          ) : (
            <p className="text-xs font-medium text-amber-700">Unavailable</p>
          )}
        </div>
      </div>
      <Progress
        value={row.percentUsed ?? 0}
        max={100}
        className="h-2 bg-[#ebe4dc]"
        indicatorClassName={row.fetchStatus === "ready" ? "bg-[#8fbf73]" : "bg-[#d0c4b8]"}
      />
      <div className="flex items-center justify-between text-[11px] text-[#8b8782]">
        <span>
          {row.fetchStatus === "ready" && row.percentUsed !== null
            ? `${row.percentUsed}% used`
            : "No live data"}
        </span>
        {row.id === "cloudflare-r2" ? <span>File storage size</span> : <span>Database size</span>}
      </div>
      {row.statusMessage ? <p className="text-[11px] text-amber-700">{row.statusMessage}</p> : null}
    </div>
  );
}
