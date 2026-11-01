import {
  mobileFailureNoteResponseSchema,
  mobileRiderParcelDetailResponseSchema,
  mobileRiderParcelPageResponseSchema,
  mobileMarkDeliveredResponseSchema,
  mobileReturnToMerchantResponseSchema,
  mobileStartDeliveryResponseSchema,
  type MobileFailureNoteResultDto,
  type MobileRiderParcelDetailDto,
  type MobileRiderParcelPageDto,
  type MobileRiderParcelTab,
} from "@parcel-flow/contract";
import { useInfiniteQuery, useMutation, useQuery, type InfiniteData } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from "@/api/client";
import { queryClient } from "@/api/query-client";
import { proofPhotoUploadPart, type ProofPhoto } from "@/delivery/proof-photo";

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

/**
 * Marks the parcel delivered with its proof photo. Like `useStartDelivery`, the
 * lists and the parcel's detail refetch whatever the outcome.
 */
export function useMarkDelivered(parcelId: string) {
  return useMutation({
    mutationFn: (photo: ProofPhoto) => {
      const formData = new FormData();
      // Expo's fetch sends any part with `bytes()` as a file; it isn't a real Blob.
      formData.append("proofImage", proofPhotoUploadPart(photo) as unknown as Blob);

      return apiPostForm(
        `/rider/parcels/${encodeURIComponent(parcelId)}/deliver`,
        formData,
        mobileMarkDeliveredResponseSchema,
      );
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rider-parcels"] }),
        queryClient.invalidateQueries({ queryKey: riderParcelQueryKey(parcelId) }),
      ]);
    },
  });
}

function failureNotePath(parcelId: string) {
  return `/rider/parcels/${encodeURIComponent(parcelId)}/failure-note`;
}

/**
 * Shared settle behaviour for the failure note mutations: the cached detail
 * takes the saved note at once, so the screen underneath the modal is right
 * when it closes, and the lists and detail refetch whatever the outcome.
 */
function failureNoteMutationOptions(parcelId: string) {
  return {
    onSuccess: (result: MobileFailureNoteResultDto) => {
      queryClient.setQueryData<MobileRiderParcelDetailDto>(
        riderParcelQueryKey(parcelId),
        (detail) =>
          detail && {
            ...detail,
            activeFailureNote: result.activeFailureNote,
            hasActiveFailureNote: result.activeFailureNote !== null,
          },
      );
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rider-parcels"] }),
        queryClient.invalidateQueries({ queryKey: riderParcelQueryKey(parcelId) }),
      ]);
    },
  };
}

/** Reports a delivery failure on the parcel with the rider's note. */
export function useReportFailure(parcelId: string) {
  return useMutation({
    mutationFn: (note: string) =>
      apiPost(failureNotePath(parcelId), { note }, mobileFailureNoteResponseSchema),
    ...failureNoteMutationOptions(parcelId),
  });
}

/** Replaces the text of the parcel's active failure note. */
export function useUpdateFailureNote(parcelId: string) {
  return useMutation({
    mutationFn: (note: string) =>
      apiPatch(failureNotePath(parcelId), { note }, mobileFailureNoteResponseSchema),
    ...failureNoteMutationOptions(parcelId),
  });
}

/** Deletes the parcel's active failure note, so it can be delivered again. */
export function useDeleteFailureNote(parcelId: string) {
  return useMutation({
    mutationFn: () => apiDelete(failureNotePath(parcelId), mobileFailureNoteResponseSchema),
    ...failureNoteMutationOptions(parcelId),
  });
}

/**
 * Marks a `canceled_returned` parcel returned to its merchant. Takes the parcel
 * id per call, so the list can use one mutation for every card. The lists and
 * the parcel's detail refetch whatever the outcome.
 */
export function useReturnToMerchant() {
  return useMutation({
    mutationFn: (parcelId: string) =>
      apiPost(
        `/rider/parcels/${encodeURIComponent(parcelId)}/return`,
        {},
        mobileReturnToMerchantResponseSchema,
      ),
    onSettled: async (_data, _error, parcelId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rider-parcels"] }),
        queryClient.invalidateQueries({ queryKey: riderParcelQueryKey(parcelId) }),
      ]);
    },
  });
}
