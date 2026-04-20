import { requireAppAccessContext } from "@/features/auth/server/utils";
import { UserProfileEditor } from "@/features/users/components/user-profile-editor";

type ProfilePageProps = {
    searchParams: Promise<{ tab?: string }>;
};

export default async function ProfilePage({ searchParams }: Readonly<ProfilePageProps>) {
    const currentUser = await requireAppAccessContext();
    const { tab } = await searchParams;

    return (
        <section className="space-y-5">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
                <p className="text-sm text-muted-foreground">
                    Manage your own account details and security settings.
                </p>
            </header>

            <UserProfileEditor
                viewer={currentUser}
                mode="self"
                activeTab={tab}
                basePath="/dashboard/profile"
            />
        </section>
    );
}
