import { revalidatePath, revalidateTag, updateTag } from "next/cache";

import {
  CACHE_TAGS,
  merchantOverviewTag,
  merchantParcelsTag,
  merchantSettlementsTag,
  PARCEL_WRITE_TAGS,
  riderParcelsTag,
} from "@/lib/cache-tags";

export function invalidateParcelWriteCaches(options?: {
  merchantUserId?: string | null;
  riderUserId?: string | null;
}) {
  for (const tag of PARCEL_WRITE_TAGS) {
    updateTag(tag);
  }

  if (options?.merchantUserId) {
    updateTag(merchantParcelsTag(options.merchantUserId));
    updateTag(merchantOverviewTag(options.merchantUserId));
    updateTag(merchantSettlementsTag(options.merchantUserId));
  }

  if (options?.riderUserId) {
    updateTag(riderParcelsTag(options.riderUserId));
  }
}

/**
 * Route-handler safe invalidation (stale-while-revalidate). Prefer updateTag in Server Actions.
 * `expireNow` makes the next read wait for fresh data instead, for callers that
 * refetch right after their own write (the mobile app).
 */
export function revalidateParcelWriteCaches(options?: {
  merchantUserId?: string | null;
  riderUserId?: string | null;
  expireNow?: boolean;
}) {
  const profile = options?.expireNow ? { expire: 0 } : "max";

  for (const tag of PARCEL_WRITE_TAGS) {
    revalidateTag(tag, profile);
  }

  if (options?.merchantUserId) {
    revalidateTag(merchantParcelsTag(options.merchantUserId), profile);
    revalidateTag(merchantOverviewTag(options.merchantUserId), profile);
    revalidateTag(merchantSettlementsTag(options.merchantUserId), profile);
  }

  if (options?.riderUserId) {
    revalidateTag(riderParcelsTag(options.riderUserId), profile);
  }
}

/** Server Actions can use updateTag; route handlers can't, so they expire the tags instead. */
export type ParcelOperationCaller = "server-action" | "route-handler";

/** Caches and dashboard paths that show a parcel's operational status. */
export function revalidateParcelOperationalPaths(options: {
  caller: ParcelOperationCaller;
  riderUserId?: string | null;
}) {
  if (options.caller === "server-action") {
    invalidateParcelWriteCaches({ riderUserId: options.riderUserId });
  } else {
    revalidateParcelWriteCaches({ riderUserId: options.riderUserId, expireNow: true });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/parcels");
  revalidatePath("/dashboard/riders");
  revalidatePath("/dashboard/merchant/parcels");
  revalidatePath("/dashboard/rider/parcels");
}

export function invalidateMerchantListCaches() {
  updateTag(CACHE_TAGS.merchants);
  updateTag(CACHE_TAGS.merchantOptions);
}

export function invalidateRiderListCaches() {
  updateTag(CACHE_TAGS.riders);
  updateTag(CACHE_TAGS.riderOptions);
}

export function invalidateUserListCaches() {
  updateTag(CACHE_TAGS.users);
}

export function invalidateTownshipCaches() {
  updateTag(CACHE_TAGS.townships);
}

export function invalidateSettlementCaches() {
  updateTag(CACHE_TAGS.settlements);
  updateTag(CACHE_TAGS.settlementWorkspace);
  updateTag(CACHE_TAGS.parcelSummary);
  updateTag(CACHE_TAGS.merchants);
  updateTag(CACHE_TAGS.riders);
}

export function invalidateRiderPayoutCaches() {
  updateTag(CACHE_TAGS.riderPayouts);
  updateTag(CACHE_TAGS.parcelSummary);
  updateTag(CACHE_TAGS.parcels);
  updateTag(CACHE_TAGS.riders);
}

export function invalidateStorageStatsCache() {
  updateTag(CACHE_TAGS.storageStats);
}
