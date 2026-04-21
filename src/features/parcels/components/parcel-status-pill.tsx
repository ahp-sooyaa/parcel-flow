import {
    COD_STATUSES,
    COLLECTION_STATUSES,
    DELIVERY_FEE_STATUSES,
    MERCHANT_SETTLEMENT_STATUSES,
    PARCEL_STATUSES,
    RIDER_PAYOUT_STATUSES,
    formatParcelStatusLabel,
} from "@/features/parcels/constants";
import { cn } from "@/lib/utils";

type ParcelStatusPillValue =
    | (typeof PARCEL_STATUSES)[number]
    | (typeof DELIVERY_FEE_STATUSES)[number]
    | (typeof COD_STATUSES)[number]
    | (typeof COLLECTION_STATUSES)[number]
    | (typeof MERCHANT_SETTLEMENT_STATUSES)[number]
    | (typeof RIDER_PAYOUT_STATUSES)[number];

type ParcelStatusTone = "muted" | "info" | "progress" | "success" | "warning" | "danger";

type ParcelStatusPillProps = {
    value: ParcelStatusPillValue;
    className?: string;
};

const statusToneByValue = {
    pending: "warning",
    out_for_pickup: "info",
    at_office: "muted",
    out_for_delivery: "progress",
    delivered: "success",
    return_to_office: "warning",
    return_to_merchant: "warning",
    returned: "danger",
    cancelled: "danger",
    unpaid: "warning",
    paid_by_merchant: "success",
    collected_from_receiver: "success",
    deduct_from_settlement: "info",
    bill_merchant: "warning",
    waived: "muted",
    not_applicable: "muted",
    collected: "success",
    not_collected: "danger",
    collected_by_rider: "info",
    received_by_office: "success",
    void: "muted",
    in_progress: "progress",
    settled: "success",
    paid: "success",
} satisfies Record<ParcelStatusPillValue, ParcelStatusTone>;

const statusToneClasses = {
    muted: "border-border bg-muted text-muted-foreground",
    info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-300",
    progress:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-300",
    success:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-300",
    danger: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300",
} satisfies Record<ParcelStatusTone, string>;

export function ParcelStatusPill({ value, className }: Readonly<ParcelStatusPillProps>) {
    return (
        <span
            className={cn(
                "inline-flex h-6 items-center rounded-full border px-2.5 text-xs leading-none font-medium whitespace-nowrap",
                statusToneClasses[statusToneByValue[value]],
                className,
            )}
        >
            {formatParcelStatusLabel(value)}
        </span>
    );
}
