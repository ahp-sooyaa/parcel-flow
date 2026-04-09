import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { advanceRiderParcelAction } from "@/features/parcels/server/actions";
import { getParcelById, getRiderParcelById } from "@/features/parcels/server/dal";
import { canEditParcel, canViewParcel } from "@/features/parcels/server/utils";

type ParcelDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ParcelDetailPage({ params }: Readonly<ParcelDetailPageProps>) {
  const currentUser = await requireAppAccessContext();
  const { id } = await params;

  if (!canViewParcel(currentUser)) {
    notFound();
  }

  if (currentUser.role.slug === "rider") {
    const parcel = await getRiderParcelById(id, currentUser);

    if (!parcel) {
      notFound();
    }

    const riderParcel = parcel;

    async function submitRiderAction() {
      "use server";

      if (!riderParcel.nextAction) {
        return;
      }

      await advanceRiderParcelAction(riderParcel.id, riderParcel.nextAction.nextStatus);
    }

    return (
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{riderParcel.parcelCode}</h1>
          <p className="text-sm text-muted-foreground">
            Rider parcel detail with the next allowed workflow step.
          </p>
        </header>

        {riderParcel.nextAction ? (
          <form action={submitRiderAction}>
            <Button type="submit">{riderParcel.nextAction.label}</Button>
          </form>
        ) : (
          <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            No rider action is available for the current parcel status.
          </p>
        )}

        <div className="grid gap-4 rounded-xl border bg-card p-5 text-sm">
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Merchant</p>
            <p>{riderParcel.merchantLabel}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Assigned Rider</p>
            <p>{riderParcel.riderLabel ?? "-"}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Recipient</p>
            <p>
              {riderParcel.recipientName} ({riderParcel.recipientPhone})
            </p>
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Recipient Township</p>
            <p>{riderParcel.recipientTownshipName ?? "-"}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Recipient Address</p>
            <p>{riderParcel.recipientAddress}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Parcel Type</p>
            <p>{riderParcel.parcelType}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Parcel Status</p>
            <p>{riderParcel.parcelStatus}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">COD Amount</p>
            <p>{riderParcel.codAmount}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Amount To Collect</p>
            <p>{riderParcel.totalAmountToCollect}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-xs text-muted-foreground">Collection Status</p>
            <p>{riderParcel.collectionStatus}</p>
          </div>
        </div>
      </section>
    );
  }

  const parcel = await getParcelById(id, currentUser);

  if (!parcel) {
    notFound();
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{parcel.parcelCode}</h1>
        <p className="text-sm text-muted-foreground">Parcel detail and payment state snapshot.</p>
      </header>

      {canEditParcel(currentUser) && (
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
    </section>
  );
}
