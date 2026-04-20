import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getUserManagementAccess } from "@/features/auth/server/policies/user-management";
import { requireAppAccessContext } from "@/features/auth/server/utils";
import { getUsersListForViewer } from "@/features/users/server/dal";
import { formatRoleSlug } from "@/lib/roles";

export default async function UsersPage() {
    const currentUser = await requireAppAccessContext();
    const userManagementAccess = getUserManagementAccess(currentUser);

    if (!userManagementAccess.canViewList) {
        notFound();
    }

    const users = await getUsersListForViewer(currentUser);

    return (
        <section className="space-y-5">
            <header className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage internal app users and account status.
                    </p>
                </div>
                {userManagementAccess.canCreate && (
                    <Button asChild>
                        <Link href="/dashboard/users/create">Create User</Link>
                    </Button>
                )}
            </header>

            <div className="overflow-hidden rounded-xl border bg-card">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id} className="border-t">
                                <td className="px-4 py-3">{user.fullName}</td>
                                <td className="px-4 py-3">{user.email}</td>
                                <td className="px-4 py-3">{user.phoneNumber ?? "-"}</td>
                                <td className="px-4 py-3">{formatRoleSlug(user.roleSlug)}</td>
                                <td className="px-4 py-3">
                                    {user.isActive ? "Active" : "Inactive"}
                                    {user.mustResetPassword ? " • Reset Required" : ""}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {userManagementAccess.canViewTarget && (
                                            <Button asChild size="sm" variant="outline">
                                                <Link href={`/dashboard/users/${user.id}`}>
                                                    View
                                                </Link>
                                            </Button>
                                        )}
                                        {userManagementAccess.canUpdateTarget && (
                                            <Button asChild size="sm" variant="outline">
                                                <Link href={`/dashboard/users/${user.id}/edit`}>
                                                    Edit
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
