import { revalidateTag, updateTag } from "next/cache";

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

/** Route-handler safe invalidation (stale-while-revalidate). Prefer updateTag in Server Actions. */
export function revalidateParcelWriteCaches(options?: {
  merchantUserId?: string | null;
  riderUserId?: string | null;
}) {
  for (const tag of PARCEL_WRITE_TAGS) {
    revalidateTag(tag, "max");
  }

  if (options?.merchantUserId) {
    revalidateTag(merchantParcelsTag(options.merchantUserId), "max");
    revalidateTag(merchantOverviewTag(options.merchantUserId), "max");
    revalidateTag(merchantSettlementsTag(options.merchantUserId), "max");
  }

  if (options?.riderUserId) {
    revalidateTag(riderParcelsTag(options.riderUserId), "max");
  }
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
