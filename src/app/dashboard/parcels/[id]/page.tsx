import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    getNextAssignedRiderAction,
    getParcelAccess,
} from "@/features/auth/server/policies/parcels";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { ParcelImageList } from "@/features/parcels/components/parcel-image-list";
import { ParcelOperationsPanel } from "@/features/parcels/components/parcel-operations-panel";
import { ParcelStatusPill } from "@/features/parcels/components/parcel-status-pill";
import { RiderParcelDetail } from "@/features/parcels/components/rider-parcel-detail";
import { formatParcelStatusLabel } from "@/features/parcels/constants";
import { getParcelByIdForViewer } from "@/features/parcels/server/dal";
import { toRiderParcelDetailDto } from "@/features/parcels/server/dto";
import { getParcelOperationSummary } from "@/features/parcels/server/utils";
import { appendDashboardReturnTo } from "@/lib/dashboard-navigation";

type ParcelDetailPageProps = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ returnTo?: string | string[] }>;
};

const detailHeaderStatuses = [
    { label: "Parcel", valueKey: "parcelStatus" },
    { label: "Collection", valueKey: "collectionStatus" },
    { label: "Delivery Fee", valueKey: "deliveryFeeStatus" },
] as const;

function getReturnTo(searchParams: Awaited<ParcelDetailPageProps["searchParams"]>) {
    const value = searchParams.returnTo;

    return Array.isArray(value) ? value[0] : value;
}

export default async function ParcelDetailPage({
    params,
    searchParams,
}: Readonly<ParcelDetailPageProps>) {
    // admin user - permission check
    // rider user - no permission, ownership check
    // merchant user - no permission, ownership check
    const currentUser = await requireAppAccessContext();
    const [{ id }, rawSearchParams] = await Promise.all([params, searchParams]);
    const returnTo = getReturnTo(rawSearchParams);

    // rider dedicated form ui
    if (currentUser.roleSlug === "rider") {
        const parcel = await getParcelByIdForViewer(currentUser, id);

        if (!parcel) {
            notFound();
        }

        return (
            <RiderParcelDetail
                parcel={toRiderParcelDetailDto({
                    ...parcel,
                    nextAction: getNextAssignedRiderAction({
                        viewer: currentUser,
                        parcel: {
                            riderId: parcel.riderId,
                            status: parcel.parcelStatus,
                        },
                    }),
                })}
            />
        );
    }

    const parcel = await getParcelByIdForViewer(currentUser, id);

    if (!parcel) {
        notFound();
    }

    // no permission for rider to access parcel detail page
    const parcelAccess = getParcelAccess({
        viewer: currentUser,
        parcel: {
            merchantId: parcel.merchantId,
        },
    });

    if (!parcelAccess.canView) {
        notFound();
    }

    const canRunOfficeOperations = currentUser.permissions.includes("parcel.update");
    const operationSummary = getParcelOperationSummary(parcel);

    return (
        <section className="mx-auto w-full max-w-5xl space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">{parcel.parcelCode}</h1>
                    <p className="text-sm text-muted-foreground">
                        Parcel detail, payment state, and office operations.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {detailHeaderStatuses.map((status) => (
                        <div
                            key={status.label}
                            className="inline-flex items-center gap-2 rounded-full border bg-card px-2 py-1"
                        >
                            <span className="text-xs text-muted-foreground">{status.label}</span>
                            <ParcelStatusPill
                                value={parcel[status.valueKey]}
                                className="h-5 px-2 text-[11px]"
                            />
                        </div>
                    ))}
                </div>
            </header>

            {parcelAccess.canUpdate && (
                <Button asChild variant="outline">
                    <Link
                        href={appendDashboardReturnTo(
                            `/dashboard/parcels/${parcel.id}/edit`,
                            returnTo,
                        )}
                    >
                        Edit Parcel Details
                    </Link>
                </Button>
            )}

            {canRunOfficeOperations && (
                <ParcelOperationsPanel parcel={parcel} operations={operationSummary} />
            )}

            <div className="grid gap-4 rounded-xl border bg-card p-5 text-sm md:grid-cols-2">
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Merchant</p>
                    <p>{parcel.merchantLabel}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Rider</p>
                    <p>{parcel.riderLabel ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Pickup Location</p>
                    <p>{parcel.pickupLocationLabel ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Pickup Township</p>
                    <p>{parcel.pickupTownshipName ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Pickup Address</p>
                    <p>{parcel.pickupAddress ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Recipient</p>
                    <p>
                        {parcel.recipientName} ({parcel.recipientPhone})
                    </p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Recipient Township</p>
                    <p>{parcel.recipientTownshipName ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Recipient Address</p>
                    <p>{parcel.recipientAddress}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Parcel Description</p>
                    <p>{parcel.parcelDescription}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Package Count</p>
                    <p>{parcel.packageCount}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Special Handling Note</p>
                    <p>{parcel.specialHandlingNote ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Estimated Weight</p>
                    <p>{parcel.estimatedWeightKg ? `${parcel.estimatedWeightKg} kg` : "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Dimensions</p>
                    <p>
                        {parcel.isLargeItem &&
                        parcel.packageWidthCm &&
                        parcel.packageHeightCm &&
                        parcel.packageLengthCm
                            ? `${parcel.packageWidthCm} x ${parcel.packageHeightCm} x ${parcel.packageLengthCm} cm`
                            : "-"}
                    </p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Parcel Status</p>
                    <ParcelStatusPill value={parcel.parcelStatus} />
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Delivery Fee Status</p>
                    <ParcelStatusPill value={parcel.deliveryFeeStatus} />
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">COD Status</p>
                    <ParcelStatusPill value={parcel.codStatus} />
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Collection Status</p>
                    <ParcelStatusPill value={parcel.collectionStatus} />
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Merchant Settlement Status</p>
                    {parcel.merchantSettlementId && currentUser.roleSlug !== "merchant" ? (
                        <Link
                            href={`/dashboard/settlements/${parcel.merchantSettlementId}`}
                            className="text-primary underline-offset-4 hover:underline"
                        >
                            {parcel.merchantSettlementStatus}
                        </Link>
                    ) : (
                        <p>{parcel.merchantSettlementStatus}</p>
                    )}
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Rider Payout Status</p>
                    <p>{parcel.riderPayoutStatus}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">COD Amount</p>
                    <p>{parcel.codAmount}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Delivery Fee</p>
                    <p>{parcel.deliveryFee}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Delivery Fee Payment Plan</p>
                    <p>
                        {parcel.deliveryFeePaymentPlan
                            ? formatParcelStatusLabel(parcel.deliveryFeePaymentPlan)
                            : "Not recorded"}
                    </p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Total Amount To Collect</p>
                    <p>{parcel.totalAmountToCollect}</p>
                </div>
            </div>

            <div className="space-y-4 rounded-xl border bg-card p-5">
                <ParcelImageList title="Pickup Images" images={parcel.pickupImages} />
                <ParcelImageList
                    title="Proof Of Delivery Images"
                    images={parcel.proofOfDeliveryImages}
                />
                {currentUser.roleSlug !== "merchant" && (
                    <ParcelImageList
                        title="Payment Slip Images"
                        images={parcel.paymentSlipImages}
                    />
                )}
            </div>
        </section>
    );
}
