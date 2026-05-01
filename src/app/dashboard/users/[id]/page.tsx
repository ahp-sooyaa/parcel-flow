import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getUserByAppUserIdForViewer } from "@/features/auth/server/dal";
import { getUserManagementAccess } from "@/features/auth/server/policies/user-management";
import { requireAppAccessContext } from "@/features/auth/server/utils";
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
                    <p className="text-xs text-muted-foreground">User Login State</p>
                    <p>
                        {user.mustResetPassword
                            ? "Must Change Password on Login"
                            : "Normal Sign-In"}
                    </p>
                </div>
            </div>
        </section>
    );
}
