import { notFound } from "next/navigation";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { EditParcelForm } from "@/features/parcels/components/edit-parcel-form";
import { getParcelById, getParcelFormOptions } from "@/features/parcels/server/dal";
import { canEditParcel } from "@/features/parcels/server/utils";

type EditParcelPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditParcelPage({ params }: Readonly<EditParcelPageProps>) {
  const currentUser = await requireAppAccessContext();

  if (!canEditParcel(currentUser)) {
    notFound();
  }

  const { id } = await params;
  const [parcel, options] = await Promise.all([
    getParcelById(id, currentUser),
    getParcelFormOptions({
      merchantId: currentUser.role.slug === "merchant" ? currentUser.appUserId : null,
    }),
  ]);

  if (!parcel) {
    notFound();
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 rounded-xl border bg-card p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Edit Parcel</h1>
        <p className="text-sm text-muted-foreground">
          Update parcel and payment statuses for {parcel.parcelCode}.
        </p>
      </header>

      <EditParcelForm
        key={parcel.id}
        parcel={parcel}
        merchants={options.merchants}
        riders={options.riders}
        townships={options.townships}
        merchantFieldReadOnly={currentUser.role.slug === "merchant"}
        accountingFieldsReadOnly={currentUser.role.slug === "merchant"}
      />
    </section>
  );
}
