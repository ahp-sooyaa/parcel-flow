import { requirePermission } from "@/features/auth/server/utils";
import { CreateTownshipForm } from "@/features/townships/components/create-township-form";

export default async function CreateTownshipPage() {
  await requirePermission("township.create");

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 rounded-xl border bg-card p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create Township</h1>
        <p className="text-sm text-muted-foreground">
          Add township master data for merchant and rider forms.
        </p>
      </header>
      <CreateTownshipForm />
    </section>
  );
}
