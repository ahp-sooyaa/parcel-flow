import { notFound } from "next/navigation";
import { getCurrentUserContext } from "@/features/auth/server/utils";
import { EditRiderForm } from "@/features/rider/components/edit-rider-form";
import { getRiderById } from "@/features/rider/server/dal";
import { canAccessRiderResource } from "@/features/rider/server/utils";
import { getTownshipOptions } from "@/features/townships/server/dal";

type EditRiderPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditRiderPage({ params }: Readonly<EditRiderPageProps>) {
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
    permission: "rider.update",
  });

  if (!canAccessRider) {
    notFound();
  }

  const [rider, townships] = await Promise.all([getRiderById(id), getTownshipOptions()]);

  if (!rider) {
    notFound();
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Edit Rider Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update rider-only operational profile fields for {rider.fullName}.
        </p>
      </header>

      <section className="space-y-5 rounded-xl border bg-card p-6">
        <EditRiderForm
          riderId={rider.id}
          fullName={rider.fullName}
          email={rider.email}
          phoneNumber={rider.phoneNumber}
          townshipId={rider.townshipId}
          vehicleType={rider.vehicleType}
          licensePlate={rider.licensePlate}
          isActive={rider.isActive}
          notes={rider.notes}
          townships={townships}
          canEditOperationalStatus={currentUser.permissions.includes("rider.update")}
        />
      </section>
    </section>
  );
}
