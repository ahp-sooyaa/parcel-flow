import { notFound } from "next/navigation";
import { getCurrentUserContext } from "@/features/auth/server/utils";
import { EditMerchantForm } from "@/features/merchant/components/edit-merchant-form";
import { getMerchantById } from "@/features/merchant/server/dal";
import { canAccessMerchantResource } from "@/features/merchant/server/utils";
import { getTownshipOptions } from "@/features/townships/server/dal";

type EditMerchantPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditMerchantPage({ params }: Readonly<EditMerchantPageProps>) {
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
    permission: "merchant.update",
  });

  if (!canAccessMerchant) {
    notFound();
  }

  const [merchant, townships] = await Promise.all([getMerchantById(id), getTownshipOptions()]);

  if (!merchant) {
    notFound();
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Edit Merchant Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update merchant-only business profile fields for {merchant.shopName}.
        </p>
      </header>

      <section className="space-y-5 rounded-xl border bg-card p-6">
        <EditMerchantForm
          merchantId={merchant.id}
          shopName={merchant.shopName}
          contactName={merchant.contactName}
          email={merchant.email}
          phoneNumber={merchant.phoneNumber}
          townshipId={merchant.pickupTownshipId}
          defaultPickupAddress={merchant.defaultPickupAddress}
          notes={merchant.notes}
          townships={townships}
        />
      </section>
    </section>
  );
}
