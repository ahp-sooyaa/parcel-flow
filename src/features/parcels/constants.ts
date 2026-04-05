export const PARCEL_TYPES = ["cod", "non_cod"] as const;
export const DELIVERY_FEE_PAYERS = ["merchant", "receiver"] as const;
export const PARCEL_STATUSES = [
  "pending",
  "out_for_pickup",
  "at_office",
  "out_for_delivery",
  "delivered",
  "return_to_office",
  "return_to_merchant",
  "returned",
  "cancelled",
] as const;
export const DELIVERY_FEE_STATUSES = [
  "unpaid",
  "paid_by_merchant",
  "collected_from_receiver",
  "deduct_from_settlement",
  "bill_merchant",
  "waived",
] as const;
export const COD_STATUSES = ["not_applicable", "pending", "collected", "not_collected"] as const;
export const COLLECTION_STATUSES = [
  "pending",
  "not_collected",
  "collected_by_rider",
  "received_by_office",
  "void",
] as const;
export const MERCHANT_SETTLEMENT_STATUSES = ["pending", "in_progress", "settled"] as const;
export const RIDER_PAYOUT_STATUSES = ["pending", "in_progress", "paid"] as const;

export const DEFAULT_CREATE_PARCEL_STATE = {
  parcelStatus: "pending",
  deliveryFeeStatus: "unpaid",
  codStatus: "pending",
  collectionStatus: "pending",
  merchantSettlementStatus: "pending",
  riderPayoutStatus: "pending",
  deliveryFeePayer: "receiver",
} as const;
