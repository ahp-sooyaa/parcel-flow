import { requireCurrentUser } from "@/features/auth/server/utils";
import { ProfileForms } from "@/features/profile/components/profile-forms";
import { getProfileByAppUserId } from "@/features/profile/server/dal";

export default async function ProfilePage() {
  const currentUser = await requireCurrentUser();
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

      <ProfileForms
        fullName={profile.fullName}
        email={profile.email}
        phoneNumber={profile.phoneNumber}
      />
    </section>
  );
}
