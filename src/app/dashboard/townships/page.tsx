import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getTownshipAccess } from "@/features/auth/server/policies/townships";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { TownshipListSearchAndFiltersForm } from "@/features/townships/components/township-list-search-and-filters-form";
import { getTownshipsListForViewer } from "@/features/townships/server/dal";
import { normalizeTownshipSearchQuery } from "@/features/townships/server/utils";

type TownshipsPageProps = {
    searchParams: Promise<{
        q?: string | string[];
    }>;
};

function getSearchParamValue(raw: string | string[] | undefined) {
    return Array.isArray(raw) ? raw[0] : raw;
}

export default async function TownshipsPage({ searchParams }: Readonly<TownshipsPageProps>) {
    const currentUser = await requireAppAccessContext();
    const townshipAccess = getTownshipAccess(currentUser);

    if (!townshipAccess.canViewList) {
        notFound();
    }

    const rawSearchParams = await searchParams;
    const query = normalizeTownshipSearchQuery(getSearchParamValue(rawSearchParams.q));
    const townships = await getTownshipsListForViewer(currentUser, { query });

    return (
        <section className="space-y-5">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Townships</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage township master data used by merchant and rider workflows.
                    </p>
                </div>
                {townshipAccess.canCreate && (
                    <Button asChild>
                        <Link href="/dashboard/townships/create">Create Township</Link>
                    </Button>
                )}
            </header>

            <TownshipListSearchAndFiltersForm query={query} clearHref="/dashboard/townships" />

            <div className="overflow-hidden rounded-xl border bg-card">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3">Township</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {townships.map((township) => (
                            <tr key={township.id} className="border-t">
                                <td className="px-4 py-3 font-medium">{township.name}</td>
                                <td className="px-4 py-3">
                                    {township.isActive ? "Active" : "Inactive"}
                                </td>
                                <td className="px-4 py-3">
                                    {township.createdAt.toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {townships.length === 0 && (
                            <tr>
                                <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={3}>
                                    No townships found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
