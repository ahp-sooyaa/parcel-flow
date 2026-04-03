import { notFound } from "next/navigation";
import { getCurrentUserContext } from "@/features/auth/server/utils";
import { getMerchantById } from "@/features/merchant/server/dal";
import { canAccessMerchantResource } from "@/features/merchant/server/utils";

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

  const merchant = await getMerchantById(id);

  if (!merchant) {
    notFound();
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{merchant.shopName}</h1>
        <p className="text-sm text-muted-foreground">Merchant detail profile</p>
      </header>

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
    </section>
  );
}
