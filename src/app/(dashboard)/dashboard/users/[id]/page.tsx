import Link from "next/link";
import { notFound } from "next/navigation";
import { IfPermitted } from "@/components/shared/if-permitted";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/features/auth/server/utils";
import { ResetUserPasswordForm } from "@/features/users/components/reset-user-password-form";
import { SoftDeleteUserForm } from "@/features/users/components/soft-delete-user-form";
import { updateUserStatusAction } from "@/features/users/server/actions";
import { getUserById } from "@/features/users/server/dal";

type UserDetailPageProps = {
  params: Promise<{ id: string }>;
};

function getRoleEditAction(input: {
  roleSlug: "super_admin" | "office_admin" | "merchant" | "rider";
  userId: string;
}) {
  if (input.roleSlug === "merchant") {
    return {
      href: `/dashboard/merchants/${input.userId}/edit`,
      label: "Edit Merchant Profile",
      permission: "merchant.update" as const,
    };
  }

  if (input.roleSlug === "rider") {
    return {
      href: `/dashboard/riders/${input.userId}/edit`,
      label: "Edit Rider Profile",
      permission: "rider.update" as const,
    };
  }

  return null;
}

export default async function UserDetailPage({ params }: Readonly<UserDetailPageProps>) {
  const currentUser = await requirePermission("user.view");
  const { id } = await params;
  const user = await getUserById(id);

  if (!user) {
    notFound();
  }

  const roleEditAction = getRoleEditAction({
    roleSlug: user.roleSlug,
    userId: user.id,
  });

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{user.fullName}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <IfPermitted permission="user.update">
          <Button asChild variant="outline">
            <Link href={`/dashboard/users/${user.id}/edit`}>Edit User</Link>
          </Button>
        </IfPermitted>
        {roleEditAction ? (
          <IfPermitted permission={roleEditAction.permission}>
            <Button asChild variant="outline">
              <Link href={roleEditAction.href}>{roleEditAction.label}</Link>
            </Button>
          </IfPermitted>
        ) : null}
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-5 text-sm">
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Phone Number</p>
          <p>{user.phoneNumber ?? "-"}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Role</p>
          <p>{user.roleLabel}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Status</p>
          <p>{user.isActive ? "Active" : "Inactive"}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs text-muted-foreground">Password Reset Requirement</p>
          <p>{user.mustResetPassword ? "Required" : "Not Required"}</p>
        </div>
      </div>

      <IfPermitted permission="user.update">
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">User Status</h2>
          <form action={updateUserStatusAction} className="flex items-center gap-3">
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="isActive" value={user.isActive ? "false" : "true"} />
            <Button type="submit" variant="outline">
              {user.isActive ? "Set Inactive" : "Set Active"}
            </Button>
          </form>
        </section>
      </IfPermitted>

      <IfPermitted permission="user-password.reset">
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="text-lg font-semibold">Admin Password Reset</h2>
          <p className="text-xs text-muted-foreground">
            This action generates a one-time temporary password and marks the account as
            reset-required.
          </p>
          <ResetUserPasswordForm userId={user.id} />
        </section>
      </IfPermitted>

      <IfPermitted permission="user.delete">
        {currentUser.role.slug === "super_admin" ? (
          <section className="space-y-3 rounded-xl border border-destructive/30 bg-card p-5">
            <h2 className="text-lg font-semibold text-destructive">Delete User</h2>
            <p className="text-xs text-muted-foreground">
              This removes the user from normal screens and day-to-day operations. The record is
              still kept for history and audit purposes.
            </p>
            <SoftDeleteUserForm userId={user.id} />
          </section>
        ) : null}
      </IfPermitted>
    </section>
  );
}
