export const MERCHANT_SETTLEMENT_TYPES = ["invoice", "remit"] as const;

export const MERCHANT_SETTLEMENT_RECORD_STATUSES = [
    "pending",
    "in_progress",
    "paid",
    "cancelled",
    "rejected",
] as const;

export const MERCHANT_SETTLEMENT_SLIP_ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

export const MERCHANT_SETTLEMENT_SLIP_MAX_SIZE_BYTES = 1024 * 1024;
