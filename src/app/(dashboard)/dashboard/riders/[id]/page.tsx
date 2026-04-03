import { notFound } from "next/navigation";
import { getCurrentUserContext } from "@/features/auth/server/utils";
import { getRiderById } from "@/features/rider/server/dal";
import { canAccessRiderResource } from "@/features/rider/server/utils";

type RiderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RiderDetailPage({ params }: Readonly<RiderDetailPageProps>) {
  const currentUser = await getCurrentUserContext();
  const { id } = await params;

  if (!currentUser) {
    notFound();
  }

  const canAccessRider = canAccessRiderResource({
    viewerRoleSlug: currentUser.role.slug,
    viewerAppUserId: currentUser.appUserId,
    riderAppUserId: id,
    viewerPermissions: currentUser.permissions,
    permission: "rider.view",
  });

  if (!canAccessRider) {
    notFound();
  }

  const rider = await getRiderById(id);

  if (!rider) {
    notFound();
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{rider.fullName}</h1>
        <p className="text-sm text-muted-foreground">Rider detail profile</p>
      </header>

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
    </section>
  );
}
