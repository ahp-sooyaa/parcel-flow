import { requirePermission } from "@/features/auth/server/utils";
import { CreateRiderForm } from "@/features/rider/components/create-rider-form";
import { getRiderLinkableUsers } from "@/features/rider/server/dal";

export default async function CreateRiderPage() {
  await requirePermission("rider.create");

  const linkableUsers = await getRiderLinkableUsers();

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 rounded-xl border bg-card p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create Rider</h1>
        <p className="text-sm text-muted-foreground">
          Register rider profile for internal delivery operations.
        </p>
      </header>
      <CreateRiderForm linkableUsers={linkableUsers} />
    </section>
  );
}
