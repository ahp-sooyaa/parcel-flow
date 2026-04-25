export const MERCHANT_SETTLEMENT_TYPES = ["invoice", "remit", "balanced"] as const;

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

export const MERCHANT_FINANCIAL_ITEM_KINDS = [
    "cod_remit_credit",
    "delivery_fee_charge",
    "refund_credit",
    "manual_adjustment",
] as const;

export const MERCHANT_FINANCIAL_DIRECTIONS = [
    "company_owes_merchant",
    "merchant_owes_company",
] as const;

export const MERCHANT_FINANCIAL_READINESS_STATES = ["ready", "blocked"] as const;

export const MERCHANT_FINANCIAL_LIFECYCLE_STATES = ["open", "locked", "closed", "void"] as const;

export const MERCHANT_SETTLEMENT_PRESETS = ["all", "cod", "fees", "returns"] as const;
