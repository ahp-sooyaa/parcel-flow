import { requirePermission } from "@/features/auth/server/utils";
import { CreateMerchantForm } from "@/features/merchant/components/create-merchant-form";
import { getMerchantLinkableUsers } from "@/features/merchant/server/dal";

export default async function CreateMerchantPage() {
  await requirePermission("merchant.create");

  const linkableUsers = await getMerchantLinkableUsers();

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 rounded-xl border bg-card p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create Merchant</h1>
        <p className="text-sm text-muted-foreground">
          Register merchant profile for internal delivery operations.
        </p>
      </header>
      <CreateMerchantForm linkableUsers={linkableUsers} />
    </section>
  );
}
