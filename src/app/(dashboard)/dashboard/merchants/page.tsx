import Link from "next/link";
import { IfPermitted } from "@/components/shared/if-permitted";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/features/auth/server/utils";
import { getMerchantsList } from "@/features/merchant/server/dal";
import { normalizeMerchantSearchQuery } from "@/features/merchant/server/utils";

type MerchantsPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function MerchantsPage({ searchParams }: Readonly<MerchantsPageProps>) {
  await requirePermission("merchant-list.view");

  const { q } = await searchParams;
  const query = normalizeMerchantSearchQuery(q);
  const merchants = await getMerchantsList({ query });

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Merchants</h1>
          <p className="text-sm text-muted-foreground">
            Browse and search merchants for quick operations lookup.
          </p>
        </div>
        <IfPermitted permission="merchant.create">
          <Button asChild>
            <Link href="/dashboard/merchants/create">Create Merchant</Link>
          </Button>
        </IfPermitted>
      </header>

      <form className="flex items-center gap-2 rounded-xl border bg-card p-3" method="get">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by merchant name or phone"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase">
            <tr>
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Township</th>
              <th className="px-4 py-3">Linked User</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {merchants.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                  No merchants found.
                </td>
              </tr>
            ) : (
              merchants.map((merchant) => (
                <tr key={merchant.id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{merchant.name}</p>
                    <p className="text-xs text-muted-foreground">{merchant.address}</p>
                  </td>
                  <td className="px-4 py-3">{merchant.phoneNumber ?? "-"}</td>
                  <td className="px-4 py-3">{merchant.township}</td>
                  <td className="px-4 py-3">{merchant.linkedAppUserName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/dashboard/merchants/${merchant.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
