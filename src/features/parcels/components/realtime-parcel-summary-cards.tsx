"use client";

import { ParcelSummaryCards } from "@/features/parcels/components/parcel-summary-cards";
import { useDebouncedRouterRefresh } from "@/features/parcels/components/use-debounced-router-refresh";
import { useParcelRealtimeEvents } from "@/features/parcels/components/use-parcel-realtime-events";
import type { ParcelSummaryDto } from "@/features/parcels/server/dto";
import { useAppRouter } from "@/lib/client-navigation";

export function RealtimeParcelSummaryCards({
  summary,
}: Readonly<{
  summary: ParcelSummaryDto;
}>) {
  const router = useAppRouter();
  const refresh = useDebouncedRouterRefresh(router);

  useParcelRealtimeEvents({
    surface: "admin-summary",
    onStatsInvalidated() {
      refresh();
    },
  });

  return <ParcelSummaryCards summary={summary} />;
}
