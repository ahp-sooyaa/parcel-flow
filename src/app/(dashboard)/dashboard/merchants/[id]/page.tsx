import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentUserContext } from "@/features/auth/server/utils";
import { getMerchantById } from "@/features/merchant/server/dal";
import { canAccessMerchantResource } from "@/features/merchant/server/utils";
import { getMerchantParcelsList } from "@/features/parcels/server/dal";
import { canEditParcel } from "@/features/parcels/server/utils";

type MerchantDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MerchantDetailPage({ params }: Readonly<MerchantDetailPageProps>) {
  const currentUser = await getCurrentUserContext();
  const { id } = await params;

  if (!currentUser) {
    notFound();
  }

  const canAccessMerchant = canAccessMerchantResource({
    viewerRoleSlug: currentUser.role.slug,
    viewerAppUserId: currentUser.appUserId,
    merchantAppUserId: id,
    viewerPermissions: currentUser.permissions,
    permission: "merchant.view",
  });

  if (!canAccessMerchant) {
    notFound();
  }

  const [merchant, merchantParcels] = await Promise.all([
    getMerchantById(id),
    getMerchantParcelsList(currentUser, id),
  ]);

  if (!merchant) {
    notFound();
  }

  const canEditMerchant = canAccessMerchantResource({
    viewerRoleSlug: currentUser.role.slug,
    viewerAppUserId: currentUser.appUserId,
    merchantAppUserId: id,
    viewerPermissions: currentUser.permissions,
    permission: "merchant.update",
  });

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{merchant.shopName}</h1>
        <p className="text-sm text-muted-foreground">Merchant detail profile</p>
      </header>

      {canEditMerchant ? (
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link href={`/dashboard/merchants/${merchant.id}/edit`}>Edit Merchant Profile</Link>
          </Button>
          {currentUser.permissions.includes("parcel.create") ? (
            <Button asChild>
              <Link href="/dashboard/parcels/create">Create Parcel</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-xl border bg-card p-5 text-sm">
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Contact Name</p>
          <p>{merchant.contactName}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Email</p>
          <p>{merchant.email}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Phone Number</p>
          <p>{merchant.phoneNumber ?? "-"}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Township</p>
          <p>{merchant.townshipName ?? "-"}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Default Pickup Address</p>
          <p>{merchant.defaultPickupAddress ?? "-"}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Notes</p>
          <p>{merchant.notes ?? "-"}</p>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Parcels</h2>
          <p className="text-sm text-muted-foreground">
            Only parcels related to this merchant are listed here.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Parcel Code</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Township</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {merchantParcels.map((parcel) => (
                <tr key={parcel.id} className="border-t">
                  <td className="px-4 py-3">{parcel.parcelCode}</td>
                  <td className="px-4 py-3">{parcel.recipientName}</td>
                  <td className="px-4 py-3">{parcel.recipientTownshipName ?? "-"}</td>
                  <td className="px-4 py-3">{parcel.parcelStatus}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/parcels/${parcel.id}`}>View</Link>
                      </Button>
                      {canEditParcel(currentUser) ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/parcels/${parcel.id}/edit`}>Edit</Link>
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {merchantParcels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    No parcels found for this merchant.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
