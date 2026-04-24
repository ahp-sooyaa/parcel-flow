import { requirePermission } from "@/features/auth/server/utils";
import { CreateParcelForm } from "@/features/parcels/components/create-parcel-form";
import { getParcelFormOptions } from "@/features/parcels/server/dal";

export default async function CreateParcelPage() {
    // admin user - permission check
    // rider user - no access
    // merchant user - permission check (will give explicit parcel.create)
    const currentUser = await requirePermission("parcel.create");

    const options = await getParcelFormOptions({
        merchantId: currentUser.roleSlug === "merchant" ? currentUser.appUserId : null,
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
                options={options}
                readOnly={{
                    merchantField: currentUser.roleSlug === "merchant",
                }}
            />
        </section>
    );
}
