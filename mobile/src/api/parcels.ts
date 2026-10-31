import {
  mobileRiderParcelDetailResponseSchema,
  mobileRiderParcelPageResponseSchema,
  mobileStartDeliveryResponseSchema,
  type MobileRiderParcelPageDto,
  type MobileRiderParcelTab,
} from "@parcel-flow/contract";
import { useInfiniteQuery, useMutation, useQuery, type InfiniteData } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/api/client";
import { queryClient } from "@/api/query-client";

// Long enough that switching tabs doesn't refetch every time, short enough that
// coming back to the app shows fresh data.
const PARCELS_STALE_TIME_MS = 30_000;

export const riderParcelsQueryKey = (tab: MobileRiderParcelTab) => ["rider-parcels", tab] as const;
export const riderParcelQueryKey = (parcelId: string) => ["rider-parcel", parcelId] as const;

export function useRiderParcels(tab: MobileRiderParcelTab) {
  return useInfiniteQuery({
    queryKey: riderParcelsQueryKey(tab),
    queryFn: ({ pageParam }) =>
      apiGet(`/rider/parcels?tab=${tab}&page=${pageParam}`, mobileRiderParcelPageResponseSchema),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: PARCELS_STALE_TIME_MS,
  });
}

/**
 * The parcel's list row, when a cached tab already has it, so the detail screen
 * can render at once while the full detail loads.
 */
function findCachedListItem(parcelId: string) {
  for (const [, data] of queryClient.getQueriesData<InfiniteData<MobileRiderParcelPageDto>>({
    queryKey: ["rider-parcels"],
  })) {
    for (const page of data?.pages ?? []) {
      const parcel = page.parcels.find((item) => item.id === parcelId);

      if (parcel) {
        return parcel;
      }
    }
  }

  return undefined;
}

/**
 * The parcel's detail, plus `preview`: its cached list row (if any) for the
 * screen to show until the detail arrives.
 */
export function useRiderParcel(parcelId: string) {
  const query = useQuery({
    queryKey: riderParcelQueryKey(parcelId),
    queryFn: () =>
      apiGet(
        `/rider/parcels/${encodeURIComponent(parcelId)}`,
        mobileRiderParcelDetailResponseSchema,
      ),
    staleTime: PARCELS_STALE_TIME_MS,
  });

  return { ...query, preview: findCachedListItem(parcelId) };
}

/**
 * Starts delivery for the given `at_office` parcels. Whatever the outcome, the
 * lists and those parcels' details refetch: on success they've moved tabs, and
 * a 404 or 409 means the screen was showing a stale state.
 */
export function useStartDelivery() {
  return useMutation({
    mutationFn: (parcelIds: string[]) =>
      apiPost("/rider/parcels/start-delivery", { parcelIds }, mobileStartDeliveryResponseSchema),
    onSettled: async (_data, _error, parcelIds) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rider-parcels"] }),
        ...parcelIds.map((parcelId) =>
          queryClient.invalidateQueries({ queryKey: riderParcelQueryKey(parcelId) }),
        ),
      ]);
    },
  });
}
