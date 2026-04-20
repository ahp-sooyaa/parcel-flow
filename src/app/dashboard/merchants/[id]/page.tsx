import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getMerchantAccess } from "@/features/auth/server/policies/merchant";
import { getParcelAccess } from "@/features/auth/server/policies/parcels";
import { isAdminRole } from "@/features/auth/server/policies/shared";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { getMerchantByIdForViewer } from "@/features/merchant/server/dal";
import { ParcelStatusPill } from "@/features/parcels/components/parcel-status-pill";
import {
    getMerchantParcelStatsForViewer,
    getMerchantParcelsListForViewer,
} from "@/features/parcels/server/dal";

type MerchantDetailPageProps = {
    params: Promise<{ id: string }>;
};

const countFormatter = new Intl.NumberFormat("en-US");
const moneyFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
});

function formatCount(value: number) {
    return countFormatter.format(value);
}

function formatMmk(value: string) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "0 MMK";
    }

    return `${moneyFormatter.format(amount)} MMK`;
}

export default async function MerchantDetailPage({ params }: Readonly<MerchantDetailPageProps>) {
    const currentUser = await requireAppAccessContext();
    const { id } = await params;

    const merchantAccess = getMerchantAccess({
        viewer: currentUser,
        merchantAppUserId: id,
    });

    if (!merchantAccess.canView) {
        notFound();
    }

    const [merchant, merchantParcels, merchantStats] = await Promise.all([
        getMerchantByIdForViewer(currentUser, id),
        getMerchantParcelsListForViewer(currentUser, id),
        getMerchantParcelStatsForViewer(currentUser, id),
    ]);

    if (!merchant) {
        notFound();
    }

    const parcelAccess = getParcelAccess({ viewer: currentUser });
    const showInternalPaymentColumns = isAdminRole(currentUser.roleSlug);
    const emptyColumnCount = showInternalPaymentColumns ? 9 : 7;

    const editMerchantHref =
        currentUser.roleSlug === "merchant"
            ? "/dashboard/profile"
            : `/dashboard/users/${merchant.id}/edit`;
    const statCards = [
        {
            label: "Total Parcels",
            value: formatCount(merchantStats.totalParcels),
        },
        {
            label: "Delivered",
            value: formatCount(merchantStats.deliveredParcels),
        },
        {
            label: "Returned",
            value: formatCount(merchantStats.returnedParcels),
        },
        {
            label: "Total COD Collected",
            value: formatMmk(merchantStats.totalCodCollected),
        },
        {
            label: "COD Remitted",
            value: formatMmk(merchantStats.codRemitted),
        },
        {
            label: "COD in Held",
            value: formatMmk(merchantStats.codInHeld),
        },
        {
            label: "Pending Delivery Fee",
            value: formatMmk(merchantStats.pendingDeliveryFee),
        },
    ];

    return (
        <section className="mx-auto w-full space-y-6">
            <header className="rounded-xl border bg-card p-5">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-3">
                        <h1 className="text-2xl font-semibold break-words">{merchant.shopName}</h1>
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
                            <p className="font-medium text-foreground">{merchant.contactName}</p>
                            <p>{merchant.phoneNumber ?? "-"}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {merchantAccess.canUpdate && (
                            <Button asChild variant="outline">
                                <Link href={editMerchantHref}>Edit Merchant Profile</Link>
                            </Button>
                        )}
                        {parcelAccess.canCreate && (
                            <Button asChild>
                                <Link href="/dashboard/parcels/create">Create Parcel</Link>
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <section className="space-y-3">
                <h2 className="text-lg font-semibold">Stats</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {statCards.map((stat) => (
                        <article key={stat.label} className="rounded-xl border bg-card p-4">
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                                {stat.label}
                            </p>
                            <p className="mt-2 text-2xl font-semibold tabular-nums">{stat.value}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="space-y-3">
                <div>
                    <h2 className="text-lg font-semibold">Parcels</h2>
                    <p className="text-sm text-muted-foreground">
                        Only parcels related to this merchant are listed here.
                    </p>
                </div>

                <div className="overflow-x-auto rounded-xl border bg-card">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/40 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3">Parcel Code</th>
                                <th className="px-4 py-3">Recipient</th>
                                <th className="px-4 py-3">Township</th>
                                <th className="px-4 py-3">Parcel Status</th>
                                <th className="px-4 py-3">COD Status</th>
                                {showInternalPaymentColumns && (
                                    <>
                                        <th className="px-4 py-3">Collection Status</th>
                                        <th className="px-4 py-3">Delivery Fee Status</th>
                                    </>
                                )}
                                <th className="px-4 py-3">Settlement</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {merchantParcels.map((parcel) => (
                                <tr key={parcel.id} className="border-t">
                                    <td className="px-4 py-3">{parcel.parcelCode}</td>
                                    <td className="px-4 py-3">{parcel.recipientName}</td>
                                    <td className="px-4 py-3">
                                        {parcel.recipientTownshipName ?? "-"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <ParcelStatusPill value={parcel.parcelStatus} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <ParcelStatusPill value={parcel.codStatus} />
                                    </td>
                                    {showInternalPaymentColumns && (
                                        <>
                                            <td className="px-4 py-3">
                                                <ParcelStatusPill value={parcel.collectionStatus} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <ParcelStatusPill
                                                    value={parcel.deliveryFeeStatus}
                                                />
                                            </td>
                                        </>
                                    )}
                                    <td className="px-4 py-3">
                                        <ParcelStatusPill value={parcel.merchantSettlementStatus} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Button asChild size="sm" variant="outline">
                                                <Link href={`/dashboard/parcels/${parcel.id}`}>
                                                    View
                                                </Link>
                                            </Button>
                                            {getParcelAccess({
                                                viewer: currentUser,
                                                parcel: {
                                                    merchantId: parcel.merchantId,
                                                    riderId: parcel.riderId,
                                                },
                                            }).canUpdate && (
                                                <Button asChild size="sm" variant="outline">
                                                    <Link
                                                        href={`/dashboard/parcels/${parcel.id}/edit`}
                                                    >
                                                        Edit
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {merchantParcels.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={emptyColumnCount}
                                        className="px-4 py-10 text-center text-xs text-muted-foreground"
                                    >
                                        No parcels found for this merchant.
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
