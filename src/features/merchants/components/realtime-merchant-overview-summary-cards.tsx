"use client";

import { useDebouncedRouterRefresh } from "@/features/parcels/components/use-debounced-router-refresh";
import { useParcelRealtimeEvents } from "@/features/parcels/components/use-parcel-realtime-events";
import { MerchantOverviewSummaryCards } from "@/features/merchants/components/merchant-overview-summary-cards";
import type { MerchantOverviewSummaryDto } from "@/features/merchants/server/dto";
import { useAppRouter } from "@/lib/client-navigation";

export function RealtimeMerchantOverviewSummaryCards({
  summary,
}: Readonly<{
  summary: MerchantOverviewSummaryDto;
}>) {
  const router = useAppRouter();
  const refresh = useDebouncedRouterRefresh(router);

  useParcelRealtimeEvents({
    surface: "merchant-summary",
    onStatsInvalidated() {
      refresh();
    },
  });

  return <MerchantOverviewSummaryCards summary={summary} />;
}
