import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getRiderAccess } from "@/features/auth/server/policies/rider";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { RiderListSearchAndFiltersForm } from "@/features/rider/components/rider-list-search-and-filters-form";
import { getRidersListForViewer } from "@/features/rider/server/dal";
import { normalizeRiderSearchQuery } from "@/features/rider/server/utils";
import { appendDashboardReturnTo, buildDashboardHref } from "@/lib/dashboard-navigation";

type RidersPageProps = {
    searchParams: Promise<{ q?: string }>;
};

export default async function RidersPage({ searchParams }: Readonly<RidersPageProps>) {
    // admin user - permission check
    // rider user - no access
    // merchant user - no access
    const currentUser = await requireAppAccessContext();
    const riderAccess = getRiderAccess({ viewer: currentUser });

    if (!riderAccess.canViewList) {
        notFound();
    }

    const { q } = await searchParams;
    const query = normalizeRiderSearchQuery(q);
    const riders = await getRidersListForViewer(currentUser, { query });
    const ridersListHref = buildDashboardHref("/dashboard/riders", {
        q: query || undefined,
    });

    return (
        <section className="space-y-5">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Riders</h1>
                    <p className="text-sm text-muted-foreground">
                        Browse and search riders for assignment and operations lookup.
                    </p>
                </div>
                {riderAccess.canCreate && (
                    <Button asChild>
                        <Link href="/dashboard/users/create?role=rider">Create Rider User</Link>
                    </Button>
                )}
            </header>

            <RiderListSearchAndFiltersForm query={query} clearHref="/dashboard/riders" />

            <div className="overflow-hidden rounded-xl border bg-card">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3">Rider</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Vehicle</th>
                            <th className="px-4 py-3">License Plate</th>
                            <th className="px-4 py-3">Township</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {riders.map((rider) => (
                            <tr key={rider.id} className="border-t">
                                <td className="px-4 py-3">
                                    <p className="font-medium">{rider.fullName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {rider.notes ?? "No rider notes"}
                                    </p>
                                </td>
                                <td className="px-4 py-3">{rider.phoneNumber ?? "-"}</td>
                                <td className="px-4 py-3">{rider.vehicleType}</td>
                                <td className="px-4 py-3">{rider.licensePlate ?? "-"}</td>
                                <td className="px-4 py-3">{rider.townshipName ?? "-"}</td>
                                <td className="px-4 py-3">
                                    {rider.isActive ? "Active" : "Inactive"}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Button asChild size="sm" variant="outline">
                                            <Link href={`/dashboard/riders/${rider.id}`}>View</Link>
                                        </Button>
                                        {riderAccess.canUpdate && (
                                            <Button asChild size="sm" variant="outline">
                                                <Link
                                                    href={appendDashboardReturnTo(
                                                        `/dashboard/users/${rider.id}/edit`,
                                                        ridersListHref,
                                                    )}
                                                >
                                                    Edit
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {riders.length === 0 && (
                            <tr>
                                <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={7}>
                                    No riders found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
