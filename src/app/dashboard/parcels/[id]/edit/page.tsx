import { notFound } from "next/navigation";
import { getParcelAccess } from "@/features/auth/server/policies/parcels";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { EditParcelForm } from "@/features/parcels/components/edit-parcel-form";
import { getParcelByIdForViewer, getParcelFormOptions } from "@/features/parcels/server/dal";

type EditParcelPageProps = {
    params: Promise<{ id: string }>;
};

export default async function EditParcelPage({ params }: Readonly<EditParcelPageProps>) {
    // admin user - permission check
    // rider user - no access to this edit form, rider have it own UI in parcel detail page
    // merchant user - no permission, ownership check
    const currentUser = await requireAppAccessContext();
    const { id } = await params;

    const [parcel, options] = await Promise.all([
        getParcelByIdForViewer(currentUser, id),
        getParcelFormOptions({
            merchantId: currentUser.roleSlug === "merchant" ? currentUser.appUserId : null,
        }),
    ]);

    if (!parcel) {
        notFound();
    }

    const parcelAccess = getParcelAccess({
        viewer: currentUser,
        parcel: {
            merchantId: parcel.merchantId,
        },
    });

    if (!parcelAccess.canUpdate) {
        notFound();
    }

    return (
        <section className="mx-auto w-full max-w-4xl space-y-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Edit Parcel Details</h1>
                <p className="text-sm text-muted-foreground">
                    Update parcel details and uploads for {parcel.parcelCode}.
                </p>
            </header>

            <EditParcelForm
                key={parcel.id}
                parcel={parcel}
                options={options}
                readOnly={{
                    merchantField: currentUser.roleSlug === "merchant",
                    accountingFields: currentUser.roleSlug === "merchant",
                }}
            />
        </section>
    );
}
