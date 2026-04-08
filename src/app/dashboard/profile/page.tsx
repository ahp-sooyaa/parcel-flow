import { requireCurrentUser } from "@/features/auth/server/utils";
import { UserProfileEditor } from "@/features/users/components/user-profile-editor";
import { getProfileByAppUserId } from "@/features/users/server/dal";

type ProfilePageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function ProfilePage({ searchParams }: Readonly<ProfilePageProps>) {
  const currentUser = await requireCurrentUser();
  const { tab } = await searchParams;
  const profile = await getProfileByAppUserId(currentUser.appUserId);

  if (!profile) {
    throw new Error("Profile not found.");
  }

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your own account details and security settings.
        </p>
      </header>

      <UserProfileEditor
        viewer={{
          appUserId: currentUser.appUserId,
          roleSlug: currentUser.role.slug,
          permissions: currentUser.permissions,
          linkedMerchantId: currentUser.linkedMerchantId,
          linkedRiderId: currentUser.linkedRiderId,
        }}
        targetUser={{
          id: currentUser.appUserId,
          fullName: profile.fullName,
          email: profile.email,
          phoneNumber: profile.phoneNumber,
          roleSlug: currentUser.role.slug,
          roleLabel: currentUser.role.label,
        }}
        mode="self"
        activeTab={tab}
        basePath="/dashboard/profile"
      />
    </section>
  );
}
