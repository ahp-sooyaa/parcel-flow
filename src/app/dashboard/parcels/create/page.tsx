import { requirePermission } from "@/features/auth/server/utils";
import { CreateParcelForm } from "@/features/parcels/components/create-parcel-form";
import { getParcelFormOptions } from "@/features/parcels/server/dal";
import { canCreateParcel } from "@/features/parcels/server/utils";

export default async function CreateParcelPage() {
  const currentUser = await requirePermission("parcel.create");

  if (!canCreateParcel(currentUser)) {
    throw new Error("Forbidden");
  }

  const options = await getParcelFormOptions({
    merchantId: currentUser.role.slug === "merchant" ? currentUser.appUserId : null,
  });

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 rounded-xl border bg-card p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create Parcel</h1>
        <p className="text-sm text-muted-foreground">
          Enter parcel details and payment record fields in one flow.
        </p>
      </header>

      <CreateParcelForm
        merchants={options.merchants}
        riders={options.riders}
        townships={options.townships}
        merchantFieldReadOnly={currentUser.role.slug === "merchant"}
      />
    </section>
  );
}
