import Link from "next/link";
import { IfPermitted } from "@/components/shared/if-permitted";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/features/auth/server/utils";
import { getRidersList } from "@/features/rider/server/dal";
import { normalizeRiderSearchQuery } from "@/features/rider/server/utils";

type RidersPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function RidersPage({ searchParams }: Readonly<RidersPageProps>) {
  await requirePermission("rider-list.view");

  const { q } = await searchParams;
  const query = normalizeRiderSearchQuery(q);
  const riders = await getRidersList({ query });

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Riders</h1>
          <p className="text-sm text-muted-foreground">
            Browse and search riders for assignment and operations lookup.
          </p>
        </div>
        <IfPermitted permission="rider.create">
          <Button asChild>
            <Link href="/dashboard/riders/create">Create Rider</Link>
          </Button>
        </IfPermitted>
      </header>

      <form className="flex items-center gap-2 rounded-xl border bg-card p-3" method="get">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search by rider code, name or phone"
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
              <th className="px-4 py-3">Rider</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Township</th>
              <th className="px-4 py-3">Linked User</th>
            </tr>
          </thead>
          <tbody>
            {riders.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                  No riders found.
                </td>
              </tr>
            ) : (
              riders.map((rider) => (
                <tr key={rider.id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{rider.fullName}</p>
                    <p className="text-xs text-muted-foreground">{rider.address}</p>
                  </td>
                  <td className="px-4 py-3">{rider.riderCode}</td>
                  <td className="px-4 py-3">{rider.phoneNumber ?? "-"}</td>
                  <td className="px-4 py-3">{rider.township}</td>
                  <td className="px-4 py-3">{rider.linkedAppUserName ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
