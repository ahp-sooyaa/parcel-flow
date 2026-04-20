import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  getNextAssignedRiderAction,
  getParcelAccess,
} from "@/features/auth/server/policies/parcels";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { ParcelImageList } from "@/features/parcels/components/parcel-image-list";
import { RiderParcelDetail } from "@/features/parcels/components/rider-parcel-detail";
import { getParcelByIdForViewer } from "@/features/parcels/server/dal";
import { toRiderParcelDetailDto } from "@/features/parcels/server/dto";

type ParcelDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ParcelDetailPage({ params }: Readonly<ParcelDetailPageProps>) {
  // admin user - permission check
  // rider user - no permission, ownership check
  // merchant user - no permission, ownership check
  const currentUser = await requireAppAccessContext();
  const { id } = await params;

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

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{parcel.parcelCode}</h1>
        <p className="text-sm text-muted-foreground">Parcel detail and payment state snapshot.</p>
      </header>

      {parcelAccess.canUpdate && (
        <Button asChild variant="outline">
          <Link href={`/dashboard/parcels/${parcel.id}/edit`}>Edit Parcel</Link>
        </Button>
      )}

      <div className="grid gap-4 rounded-xl border bg-card p-5 text-sm">
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Merchant</p>
          <p>{parcel.merchantLabel}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Rider</p>
          <p>{parcel.riderLabel ?? "-"}</p>
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
            {parcel.packageWidthCm && parcel.packageHeightCm && parcel.packageLengthCm
              ? `${parcel.packageWidthCm} x ${parcel.packageHeightCm} x ${parcel.packageLengthCm} cm`
              : "-"}
          </p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Parcel Status</p>
          <p>{parcel.parcelStatus}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Delivery Fee Status</p>
          <p>{parcel.deliveryFeeStatus}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">COD Status</p>
          <p>{parcel.codStatus}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Collection Status</p>
          <p>{parcel.collectionStatus}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Merchant Settlement Status</p>
          <p>{parcel.merchantSettlementStatus}</p>
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
          <p className="text-xs text-muted-foreground">Total Amount To Collect</p>
          <p>{parcel.totalAmountToCollect}</p>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-5">
        <ParcelImageList title="Pickup Images" images={parcel.pickupImages} />
        <ParcelImageList title="Proof Of Delivery Images" images={parcel.proofOfDeliveryImages} />
        {currentUser.roleSlug !== "merchant" && (
          <ParcelImageList title="Payment Slip Images" images={parcel.paymentSlipImages} />
        )}
      </div>
    </section>
  );
}
