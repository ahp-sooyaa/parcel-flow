import { cn } from "@/lib/utils";

import type { MerchantSettlementStatus } from "@/features/merchant-settlements/server/dto";

const statusClasses: Record<MerchantSettlementStatus, string> = {
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    in_progress: "border-blue-200 bg-blue-50 text-blue-700",
    paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cancelled: "border-muted bg-muted text-muted-foreground",
    rejected: "border-destructive/20 bg-destructive/10 text-destructive",
};

function formatMerchantSettlementLabel(value: string) {
    return value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function MerchantSettlementStatusPill({
    value,
    className,
}: Readonly<{
    value: MerchantSettlementStatus;
    className?: string;
}>) {
    return (
        <span
            className={cn(
                "inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium whitespace-nowrap",
                statusClasses[value],
                className,
            )}
        >
            {formatMerchantSettlementLabel(value)}
        </span>
    );
}
