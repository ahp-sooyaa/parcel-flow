import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/features/auth/server/utils";
import { getParcelsList } from "@/features/parcels/server/dal";
import { canAccessParcelList, canEditParcel } from "@/features/parcels/server/utils";

export default async function ParcelsPage() {
  const currentUser = await getCurrentUserContext();

  if (!currentUser || !canAccessParcelList(currentUser)) {
    notFound();
  }

  const parcels = await getParcelsList(currentUser);

  return (
    <section className="space-y-5">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parcels</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage parcel operations with linked payment states.
          </p>
        </div>
        {currentUser.permissions.includes("parcel.create") && (
          <Button asChild>
            <Link href="/dashboard/parcels/create">Create Parcel</Link>
          </Button>
        )}
      </header>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase">
            <tr>
              <th className="px-4 py-3">Parcel Code</th>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Township</th>
              <th className="px-4 py-3">Parcel Status</th>
              <th className="px-4 py-3">Delivery Fee Status</th>
              <th className="px-4 py-3">Collection Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {parcels.map((parcel) => (
              <tr key={parcel.id} className="border-t">
                <td className="px-4 py-3">{parcel.parcelCode}</td>
                <td className="px-4 py-3">{parcel.merchantLabel}</td>
                <td className="px-4 py-3">{parcel.recipientName}</td>
                <td className="px-4 py-3">{parcel.recipientTownshipName ?? "-"}</td>
                <td className="px-4 py-3">{parcel.parcelStatus}</td>
                <td className="px-4 py-3">{parcel.deliveryFeeStatus}</td>
                <td className="px-4 py-3">{parcel.collectionStatus}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/parcels/${parcel.id}`}>View</Link>
                    </Button>
                    {canEditParcel(currentUser) && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/parcels/${parcel.id}/edit`}>Edit</Link>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {parcels.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No parcels found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
