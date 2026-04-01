import { notFound } from "next/navigation";
import { requirePermission } from "@/features/auth/server/utils";
import { getMerchantByIdForViewer } from "@/features/merchant/server/dal";

type MerchantDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MerchantDetailPage({ params }: Readonly<MerchantDetailPageProps>) {
  const currentUser = await requirePermission("merchant.view");

  const { id } = await params;
  const merchant = await getMerchantByIdForViewer({
    merchantId: id,
    viewerRoleSlug: currentUser.role.slug,
    viewerAppUserId: currentUser.appUserId,
  });

  if (!merchant) {
    notFound();
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{merchant.name}</h1>
        <p className="text-sm text-muted-foreground">Merchant detail profile</p>
      </header>

      <div className="grid gap-4 rounded-xl border bg-card p-5 text-sm">
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Phone Number</p>
          <p>{merchant.phoneNumber ?? "-"}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Township</p>
          <p>{merchant.township}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Address</p>
          <p>{merchant.address}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Notes</p>
          <p>{merchant.notes ?? "-"}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Linked App User</p>
          <p>{merchant.linkedAppUserName ?? "-"}</p>
        </div>
      </div>
    </section>
  );
}
