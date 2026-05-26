"use client";

import { MerchantParcelBrowser } from "@/features/parcels/components/merchant-parcel-browser";
import { useDebouncedRouterRefresh } from "@/features/parcels/components/use-debounced-router-refresh";
import { useParcelRealtimeEvents } from "@/features/parcels/components/use-parcel-realtime-events";
import type { MerchantParcelListFiltersDto, MerchantParcelListPageDto } from "@/features/parcels/server/dto";
import { useAppRouter } from "@/lib/client-navigation";

export function RealtimeMerchantParcelBrowser(props: Readonly<{
  result: MerchantParcelListPageDto;
  filters: MerchantParcelListFiltersDto;
}>) {
  const router = useAppRouter();
  const refresh = useDebouncedRouterRefresh(router);

  useParcelRealtimeEvents({
    surface: "merchant-list",
    onParcelUpsert() {
      refresh();
    },
    onParcelRemove() {
      refresh();
    },
  });

  return <MerchantParcelBrowser {...props} />;
}
