export const CACHE_TAGS = {
  parcels: "parcels",
  parcelSummary: "parcel-summary",
  merchants: "merchants",
  merchantOptions: "merchant-options",
  riders: "riders",
  riderOptions: "rider-options",
  townships: "townships",
  users: "users",
  settlements: "settlements",
  settlementWorkspace: "settlement-workspace",
  riderPayouts: "rider-payouts",
  storageStats: "storage-stats",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

export function merchantParcelsTag(userId: string) {
  return `merchant-parcels:${userId}`;
}

export function merchantOverviewTag(userId: string) {
  return `merchant-overview:${userId}`;
}

export function merchantSettlementsTag(userId: string) {
  return `merchant-settlements:${userId}`;
}

export function riderParcelsTag(userId: string) {
  return `rider-parcels:${userId}`;
}

export function userProfileTag(userId: string) {
  return `user-profile:${userId}`;
}

export function userBanksTag(userId: string) {
  return `user-banks:${userId}`;
}

/** Tags to bust when any parcel write changes operational lists/summaries. */
export const PARCEL_WRITE_TAGS = [
  CACHE_TAGS.parcels,
  CACHE_TAGS.parcelSummary,
  CACHE_TAGS.merchants,
  CACHE_TAGS.riders,
  CACHE_TAGS.settlements,
  CACHE_TAGS.settlementWorkspace,
  CACHE_TAGS.riderPayouts,
] as const;
