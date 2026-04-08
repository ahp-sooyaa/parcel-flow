import { isRoleSlug, type RoleSlug } from "@/db/constants";
import { requirePermission } from "@/features/auth/server/utils";
import { getTownshipOptions } from "@/features/townships/server/dal";
import { CreateUserForm } from "@/features/users/components/create-user-form";

type CreateUserPageProps = {
  searchParams: Promise<{ role?: string }>;
};

export default async function CreateUserPage({ searchParams }: Readonly<CreateUserPageProps>) {
  const currentUser = await requirePermission("user.create");
  const townships = await getTownshipOptions();
  const { role } = await searchParams;
  const defaultRole: RoleSlug = role && isRoleSlug(role) ? role : "office_admin";

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 rounded-xl border bg-card p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create User</h1>
        <p className="text-sm text-muted-foreground">
          Create internal users with role assignment and secure temporary credentials.
        </p>
      </header>
      <CreateUserForm
        canCreateSuperAdmin={currentUser.role.slug === "super_admin"}
        townships={townships}
        defaultRole={defaultRole}
      />
    </section>
  );
}
