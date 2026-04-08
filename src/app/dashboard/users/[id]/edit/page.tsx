import Link from "next/link";
import { notFound } from "next/navigation";
import { IfPermitted } from "@/components/shared/if-permitted";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/features/auth/server/utils";
import { EditUserForm } from "@/features/users/components/edit-user-form";
import { SoftDeleteUserForm } from "@/features/users/components/soft-delete-user-form";
import { getUserById } from "@/features/users/server/dal";
import { getUserRoleEditAction } from "@/features/users/server/utils";

type EditUserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditUserPage({ params }: Readonly<EditUserPageProps>) {
  await requirePermission("user.update");
  const { id } = await params;
  const user = await getUserById(id);

  if (!user) {
    notFound();
  }

  const roleEditAction = getUserRoleEditAction({
    roleSlug: user.roleSlug,
    userId: user.id,
  });

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Edit User</h1>
        <p className="text-sm text-muted-foreground">
          Update shared app user profile data for {user.fullName}.
        </p>
      </header>

      <section className="space-y-5 rounded-xl border bg-card p-6">
        <EditUserForm
          userId={user.id}
          fullName={user.fullName}
          email={user.email}
          phoneNumber={user.phoneNumber}
          roleLabel={user.roleLabel}
        />
      </section>

      {roleEditAction && (
        <IfPermitted permission={roleEditAction.permission}>
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Linked Role Profile</h2>
            <p className="text-xs text-muted-foreground">
              Role-specific merchant and rider data is managed in its own edit workflow.
            </p>
            <Button asChild variant="outline">
              <Link href={roleEditAction.href}>{roleEditAction.label}</Link>
            </Button>
          </section>
        </IfPermitted>
      )}

      <IfPermitted permission="user.delete">
        <section className="space-y-3 rounded-xl border border-destructive/30 bg-card p-5">
          <h2 className="text-lg font-semibold text-destructive">Delete User</h2>
          <p className="text-xs text-muted-foreground">
            This removes the user and any linked merchant or rider profile from normal screens. The
            record is still kept for history and audit purposes.
          </p>
          <SoftDeleteUserForm userId={user.id} />
        </section>
      </IfPermitted>
    </section>
  );
}
