import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getUserByAppUserIdForViewer } from "@/features/auth/server/dal";
import { getUserManagementAccess } from "@/features/auth/server/policies/user-management";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { ResetUserPasswordForm } from "@/features/users/components/reset-user-password-form";
import { SoftDeleteUserForm } from "@/features/users/components/soft-delete-user-form";
import { updateUserStatusAction } from "@/features/users/server/actions";
import { appendDashboardReturnTo } from "@/lib/dashboard-navigation";
import { formatRoleSlug } from "@/lib/roles";

type UserDetailPageProps = {
    params: Promise<{ id: string }>;
};

export default async function UserDetailPage({ params }: Readonly<UserDetailPageProps>) {
    const currentUser = await requireAppAccessContext();
    const userManagementAccess = getUserManagementAccess(currentUser);

    if (!userManagementAccess.canViewTarget) {
        notFound();
    }

    const { id } = await params;
    const user = await getUserByAppUserIdForViewer(currentUser, id);

    if (!user) {
        notFound();
    }

    const userDetailHref = `/dashboard/users/${user.appUserId}`;

    return (
        <section className="mx-auto w-full max-w-3xl space-y-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">{user.fullName}</h1>
                <p className="text-sm text-muted-foreground">{user.email}</p>
            </header>

            <div className="flex flex-wrap gap-2">
                {userManagementAccess.canUpdateTarget && (
                    <Button asChild variant="outline">
                        <Link
                            href={appendDashboardReturnTo(
                                `/dashboard/users/${user.appUserId}/edit`,
                                userDetailHref,
                            )}
                        >
                            Edit User
                        </Link>
                    </Button>
                )}
            </div>

            <div className="grid gap-4 rounded-xl border bg-card p-5 text-sm">
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Phone Number</p>
                    <p>{user.phoneNumber ?? "-"}</p>
                </div>
                <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Role</p>
                    <p>{formatRoleSlug(user.roleSlug)}</p>
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

            {userManagementAccess.canUpdateTarget && (
                <section className="space-y-3 rounded-xl border bg-card p-5">
                    <h2 className="text-lg font-semibold">User Status</h2>
                    <form action={updateUserStatusAction} className="flex items-center gap-3">
                        <input type="hidden" name="userId" value={user.appUserId} />
                        <input
                            type="hidden"
                            name="isActive"
                            value={user.isActive ? "false" : "true"}
                        />
                        <Button type="submit" variant="outline">
                            {user.isActive ? "Set Inactive" : "Set Active"}
                        </Button>
                    </form>
                </section>
            )}

            {userManagementAccess.canResetPasswordTarget && (
                <section className="space-y-3 rounded-xl border bg-card p-5">
                    <h2 className="text-lg font-semibold">Admin Password Reset</h2>
                    <p className="text-xs text-muted-foreground">
                        This action generates a one-time temporary password and marks the account as
                        reset-required.
                    </p>
                    <ResetUserPasswordForm userId={user.appUserId} />
                </section>
            )}

            {userManagementAccess.canDeleteTarget && (
                <section className="space-y-3 rounded-xl border border-destructive/30 bg-card p-5">
                    <h2 className="text-lg font-semibold text-destructive">Delete User</h2>
                    <p className="text-xs text-muted-foreground">
                        This removes the user from normal screens and day-to-day operations. The
                        record is still kept for history and audit purposes.
                    </p>
                    <SoftDeleteUserForm userId={user.appUserId} />
                </section>
            )}
        </section>
    );
}
