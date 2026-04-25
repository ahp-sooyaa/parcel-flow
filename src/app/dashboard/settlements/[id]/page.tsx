import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getMerchantSettlementAccess } from "@/features/auth/server/policies/merchant-settlements";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { MerchantSettlementPaymentActions } from "@/features/merchant-settlements/components/merchant-settlement-payment-actions";
import { MerchantSettlementStatusPill } from "@/features/merchant-settlements/components/merchant-settlement-status-pill";
import { getMerchantSettlementDetailForViewer } from "@/features/merchant-settlements/server/dal";
import { formatMerchantSettlementLabel } from "@/features/merchant-settlements/server/utils";

type SettlementDetailPageProps = {
    params: Promise<{ id: string }>;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Yangon",
    year: "numeric",
});

function formatMmk(value: string) {
    const amount = Number(value);

    return `${moneyFormatter.format(Number.isFinite(amount) ? amount : 0)} MMK`;
}

export default async function SettlementDetailPage({
    params,
}: Readonly<SettlementDetailPageProps>) {
    const currentUser = await requireAppAccessContext();
    const settlementAccess = getMerchantSettlementAccess(currentUser);

    if (!settlementAccess.canView) {
        notFound();
    }

    const { id } = await params;
    const settlement = await getMerchantSettlementDetailForViewer(currentUser, id);

    if (!settlement) {
        notFound();
    }

    const title = settlement.referenceNo ?? `Settlement ${settlement.id.slice(0, 8)}`;

    return (
        <section className="space-y-6">
            <header className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-2xl font-semibold tracking-tight break-words">
                                {title}
                            </h1>
                            <MerchantSettlementStatusPill value={settlement.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Merchant settlement document for {settlement.merchantLabel}.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="outline">
                            <Link
                                href={`/dashboard/merchants/${settlement.merchantId}?tab=settlements`}
                            >
                                View Merchant
                            </Link>
                        </Button>
                        <Button asChild>
                            <a href={`/dashboard/settlements/${settlement.id}/invoice`}>
                                Download Invoice
                            </a>
                        </Button>
                    </div>
                </div>
            </header>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Credits</p>
                    <p className="mt-2 text-xl font-semibold tabular-nums">
                        {formatMmk(settlement.totals.creditsTotal)}
                    </p>
                </article>
                <article className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Debits</p>
                    <p className="mt-2 text-xl font-semibold tabular-nums">
                        {formatMmk(settlement.totals.debitsTotal)}
                    </p>
                </article>
                <article className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Net</p>
                    <p className="mt-2 text-xl font-semibold tabular-nums">
                        {formatMmk(settlement.totals.netTotal)}
                    </p>
                </article>
                <article className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Items</p>
                    <p className="mt-2 text-xl font-semibold tabular-nums">
                        {settlement.itemCount}
                    </p>
                </article>
            </section>

            <section className="grid gap-4 rounded-xl border bg-card p-5 text-sm lg:grid-cols-3">
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Merchant</p>
                    <p>{settlement.merchantLabel}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Settlement ID</p>
                    <p className="break-all">{settlement.id}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Reference</p>
                    <p>{settlement.referenceNo ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p>{formatMerchantSettlementLabel(settlement.type)}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Method</p>
                    <p>{formatMerchantSettlementLabel(settlement.method)}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p>{formatMerchantSettlementLabel(settlement.status)}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Counterparty Bank</p>
                    <p>{settlement.snapshotBankName ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Bank Account</p>
                    <p>{settlement.snapshotBankAccountNumber ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Created By</p>
                    <p>{settlement.createdByActor.name}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Confirmed By</p>
                    <p>{settlement.confirmedByActor?.name ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p>{dateFormatter.format(settlement.createdAt)}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Updated</p>
                    <p>{dateFormatter.format(settlement.updatedAt)}</p>
                </div>
                {settlement.note && (
                    <div className="grid gap-1 lg:col-span-3">
                        <p className="text-xs text-muted-foreground">Note</p>
                        <p>{settlement.note}</p>
                    </div>
                )}
            </section>

            {settlement.paymentSlipImages.length > 0 && (
                <section className="space-y-3 rounded-xl border bg-card p-5">
                    <h2 className="text-lg font-semibold">Proof Of Payment</h2>
                    <div className="flex flex-wrap gap-2">
                        {settlement.paymentSlipImages.map((image, index) => (
                            <Button key={image.key} asChild variant="outline" size="sm">
                                <a href={image.url} target="_blank" rel="noreferrer">
                                    Payment Slip {index + 1}
                                </a>
                            </Button>
                        ))}
                    </div>
                </section>
            )}

            <MerchantSettlementPaymentActions
                settlement={{ id: settlement.id, status: settlement.status, type: settlement.type }}
                permissions={{
                    canConfirm: settlementAccess.canConfirm,
                    canCancel: settlementAccess.canCancel,
                }}
            />

            <section className="space-y-3">
                <div>
                    <h2 className="text-lg font-semibold">Settlement Items</h2>
                    <p className="text-sm text-muted-foreground">
                        Financial amounts use settlement item snapshots.
                    </p>
                </div>

                <div className="overflow-x-auto rounded-xl border bg-card">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/40 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Direction</th>
                                <th className="px-4 py-3">Parcel Code</th>
                                <th className="px-4 py-3">Recipient</th>
                                <th className="px-4 py-3">Township</th>
                                <th className="px-4 py-3">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {settlement.items.map((item) => (
                                <tr key={item.id} className="border-t">
                                    <td className="px-4 py-3">
                                        {formatMerchantSettlementLabel(item.candidateKind)}
                                    </td>
                                    <td className="px-4 py-3">
                                        {formatMerchantSettlementLabel(item.direction)}
                                    </td>
                                    <td className="px-4 py-3">
                                        {item.parcelId ? (
                                            <Link
                                                href={`/dashboard/parcels/${item.parcelId}`}
                                                className="font-medium underline-offset-4 hover:underline"
                                            >
                                                {item.parcelCode ?? item.parcelId.slice(0, 8)}
                                            </Link>
                                        ) : (
                                            (item.parcelCode ?? "-")
                                        )}
                                    </td>
                                    <td className="px-4 py-3">{item.recipientName ?? "-"}</td>
                                    <td className="px-4 py-3">
                                        {item.recipientTownshipName ?? "-"}
                                    </td>
                                    <td className="px-4 py-3 font-medium tabular-nums">
                                        {formatMmk(item.snapshotAmount)}
                                    </td>
                                </tr>
                            ))}
                            {settlement.items.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-4 py-10 text-center text-xs text-muted-foreground"
                                    >
                                        No settlement items found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </section>
    );
}
