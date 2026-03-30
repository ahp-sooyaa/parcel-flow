import Link from "next/link";
import { IfPermitted } from "@/components/shared/if-permitted";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/features/auth/server/utils";

export default async function DashboardPage() {
  await requirePermission("dashboard-page.view");

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Internal delivery operations overview.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <IfPermitted permission="user-list.view">
          <article className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">User Management</p>
            <p className="mt-2 text-sm">Create accounts, manage status, and reset passwords.</p>
            <Button asChild className="mt-4" size="sm" variant="outline">
              <Link href="/dashboard/users">Open Users</Link>
            </Button>
          </article>
        </IfPermitted>

        <IfPermitted permission="parcel-list.view">
          <article className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Parcels</p>
            <p className="mt-2 text-sm">View assigned parcel queue.</p>
            <Button asChild className="mt-4" size="sm" variant="outline">
              <Link href="/dashboard/parcels">Open Parcels</Link>
            </Button>
          </article>
        </IfPermitted>

        <IfPermitted permission="merchant-list.view">
          <article className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Merchant</p>
            <p className="mt-2 text-sm">Review merchant-specific area.</p>
            <Button asChild className="mt-4" size="sm" variant="outline">
              <Link href="/dashboard/merchants">Open Merchants</Link>
            </Button>
          </article>
        </IfPermitted>
      </div>
    </section>
  );
}
