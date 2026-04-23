import { requireAppAccessContext } from "@/features/auth/server/utils";
import { UserSettingsEditor } from "@/features/users/components/user-settings-editor";

type SettingsPageProps = {
    searchParams: Promise<{ tab?: string }>;
};

export default async function SettingsPage({ searchParams }: Readonly<SettingsPageProps>) {
    const currentUser = await requireAppAccessContext();
    const { tab } = await searchParams;

    return (
        <section className="space-y-5">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground">
                    Manage account details, security, role-specific details, and bank accounts.
                </p>
            </header>

            <UserSettingsEditor
                viewer={currentUser}
                mode="self"
                activeTab={tab}
                basePath="/dashboard/settings"
            />
        </section>
    );
}
