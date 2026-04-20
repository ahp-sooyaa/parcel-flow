import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getMerchantAccess } from "@/features/auth/server/policies/merchant";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { getMerchantsListForViewer } from "@/features/merchant/server/dal";
import { normalizeMerchantSearchQuery } from "@/features/merchant/server/utils";

type MerchantsPageProps = {
    searchParams: Promise<{ q?: string }>;
};

export default async function MerchantsPage({ searchParams }: Readonly<MerchantsPageProps>) {
    const currentUser = await requireAppAccessContext();
    const merchantAccess = getMerchantAccess({ viewer: currentUser });

    if (!merchantAccess.canViewList) {
        notFound();
    }

    const { q } = await searchParams;
    const query = normalizeMerchantSearchQuery(q);
    const merchants = await getMerchantsListForViewer(currentUser, { query });

    return (
        <section className="space-y-5">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Merchants</h1>
                    <p className="text-sm text-muted-foreground">
                        Browse and search merchants for quick operations lookup.
                    </p>
                </div>
                {merchantAccess.canCreate && (
                    <Button asChild>
                        <Link href="/dashboard/users/create?role=merchant">
                            Create Merchant User
                        </Link>
                    </Button>
                )}
            </header>

            <form className="flex items-center gap-2 rounded-xl border bg-card p-3" method="get">
                <input
                    name="q"
                    defaultValue={query}
                    placeholder="Search by shop name or contact name"
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
                            <th className="px-4 py-3">Shop</th>
                            <th className="px-4 py-3">Contact</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Township</th>
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
                                        <p className="font-medium">{merchant.shopName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {merchant.defaultPickupAddress ??
                                                "No default pickup address"}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">{merchant.contactName}</td>
                                    <td className="px-4 py-3">{merchant.phoneNumber ?? "-"}</td>
                                    <td className="px-4 py-3">{merchant.townshipName ?? "-"}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Button asChild size="sm" variant="outline">
                                                <Link href={`/dashboard/merchants/${merchant.id}`}>
                                                    View
                                                </Link>
                                            </Button>
                                            {merchantAccess.canUpdate && (
                                                <Button asChild size="sm" variant="outline">
                                                    <Link
                                                        href={`/dashboard/users/${merchant.id}/edit`}
                                                    >
                                                        Edit
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
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
