import { Button } from "@/components/ui/button";
import { advanceRiderParcelAction } from "@/features/parcels/server/actions";

import type { RiderParcelDetailDto } from "@/features/parcels/server/dto";

type RiderParcelDetailProps = {
  parcel: RiderParcelDetailDto;
};

export function RiderParcelDetail({ parcel }: Readonly<RiderParcelDetailProps>) {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{parcel.parcelCode}</h1>
        <p className="text-sm text-muted-foreground">
          Rider parcel detail with the next allowed workflow step.
        </p>
      </header>

      {parcel.nextAction ? (
        <form action={advanceRiderParcelAction}>
          <input type="hidden" name="parcelId" value={parcel.id} />
          <input type="hidden" name="nextStatus" value={parcel.nextAction.nextStatus} />
          <Button type="submit">{parcel.nextAction.label}</Button>
        </form>
      ) : (
        <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
          No rider action is available for the current parcel status.
        </p>
      )}

      <div className="grid gap-4 rounded-xl border bg-card p-5 text-sm">
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Merchant</p>
          <p>{parcel.merchantLabel}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Assigned Rider</p>
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
          <p className="text-xs text-muted-foreground">Parcel Type</p>
          <p>{parcel.parcelType}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Parcel Status</p>
          <p>{parcel.parcelStatus}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">COD Amount</p>
          <p>{parcel.codAmount}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Amount To Collect</p>
          <p>{parcel.totalAmountToCollect}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Collection Status</p>
          <p>{parcel.collectionStatus}</p>
        </div>
      </div>
    </section>
  );
}
