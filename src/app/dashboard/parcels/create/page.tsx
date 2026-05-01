import { requirePermission } from "@/features/auth/server/utils";
import { CreateParcelForm } from "@/features/parcels/components/create-parcel-form";
import { getParcelFormOptions } from "@/features/parcels/server/dal";

type CreateParcelPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getMerchantIdParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }

    return typeof value === "string" && value.trim() ? value.trim() : null;
}

export default async function CreateParcelPage({ searchParams }: Readonly<CreateParcelPageProps>) {
    // admin user - permission check
    // rider user - no access
    // merchant user - permission check (will give explicit parcel.create)
    const currentUser = await requirePermission("parcel.create");
    const rawSearchParams = await searchParams;
    const requestedMerchantId = getMerchantIdParam(rawSearchParams.merchantId);

    const options = await getParcelFormOptions({
        merchantId: currentUser.roleSlug === "merchant" ? currentUser.appUserId : null,
    });
    const initialMerchantId =
        currentUser.roleSlug === "merchant"
            ? currentUser.appUserId
            : options.merchants.some((merchant) => merchant.id === requestedMerchantId)
              ? requestedMerchantId
              : null;

    return (
        <section className="mx-auto w-full max-w-3xl space-y-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Create Parcel</h1>
                <p className="text-sm text-muted-foreground">
                    Enter parcel details and payment record fields in one flow.
                </p>
            </header>

            <CreateParcelForm
                options={options}
                initialMerchantId={initialMerchantId}
                readOnly={{
                    merchantField: currentUser.roleSlug === "merchant",
                }}
            />
        </section>
    );
}
