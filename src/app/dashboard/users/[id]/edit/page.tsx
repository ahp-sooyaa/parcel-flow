import { notFound } from "next/navigation";
import { IfPermitted } from "@/components/shared/if-permitted";
import { requirePermission } from "@/features/auth/server/utils";
import { SoftDeleteUserForm } from "@/features/users/components/soft-delete-user-form";
import { UserProfileEditor } from "@/features/users/components/user-profile-editor";
import { getAppUserDetailById } from "@/features/users/server/dal";

type EditUserPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function EditUserPage({ params, searchParams }: Readonly<EditUserPageProps>) {
  const currentUser = await requirePermission("user.update");
  const { id } = await params;
  const { tab } = await searchParams;
  const user = await getAppUserDetailById(id);

  if (!user) {
    notFound();
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Edit User</h1>
        <p className="text-sm text-muted-foreground">
          Update shared app user profile data for {user.fullName}.
        </p>
      </header>

      <UserProfileEditor
        viewer={currentUser}
        targetUser={user}
        mode="admin"
        activeTab={tab}
        basePath={`/dashboard/users/${user.id}/edit`}
      />

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
