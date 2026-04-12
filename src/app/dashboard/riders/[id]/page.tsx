import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { getAssignedRiderParcelsList } from "@/features/parcels/server/dal";
import { getRiderById } from "@/features/rider/server/dal";
import { getRiderResourceAccess } from "@/features/rider/server/utils";

type RiderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RiderDetailPage({ params }: Readonly<RiderDetailPageProps>) {
  // admin user - permission check
  // rider user - no permission, ownership check
  // merchant user - no access
  const currentUser = await requireAppAccessContext();
  const { id } = await params;

  const riderAccess = getRiderResourceAccess({
    viewer: currentUser,
    riderAppUserId: id,
  });

  if (!riderAccess.canView) {
    notFound();
  }

  const [rider, riderParcels] = await Promise.all([
    getRiderById(id),
    getAssignedRiderParcelsList(id),
  ]);

  if (!rider) {
    notFound();
  }

  const editRiderHref =
    currentUser.roleSlug === "rider" ? "/dashboard/profile" : `/dashboard/users/${rider.id}/edit`;

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{rider.fullName}</h1>
        <p className="text-sm text-muted-foreground">Rider detail profile</p>
      </header>

      {riderAccess.canUpdate && (
        <div>
          <Button asChild variant="outline">
            <Link href={editRiderHref}>Edit Rider Profile</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 rounded-xl border bg-card p-5 text-sm">
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Email</p>
          <p>{rider.email}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Phone Number</p>
          <p>{rider.phoneNumber ?? "-"}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Township</p>
          <p>{rider.townshipName ?? "-"}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Vehicle Type</p>
          <p>{rider.vehicleType}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">License Plate</p>
          <p>{rider.licensePlate ?? "-"}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Status</p>
          <p>{rider.isActive ? "Active" : "Inactive"}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Notes</p>
          <p>{rider.notes ?? "-"}</p>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Assigned Parcels</h2>
          <p className="text-sm text-muted-foreground">
            The rider can only access parcels assigned to this rider profile.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Parcel Code</th>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {riderParcels.map((parcel) => (
                <tr key={parcel.id} className="border-t">
                  <td className="px-4 py-3">{parcel.parcelCode}</td>
                  <td className="px-4 py-3">{parcel.merchantLabel}</td>
                  <td className="px-4 py-3">{parcel.recipientName}</td>
                  <td className="px-4 py-3">{parcel.parcelStatus}</td>
                  <td className="px-4 py-3">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/parcels/${parcel.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {riderParcels.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-xs text-muted-foreground">
                    No assigned parcels found.
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
