import Link from "next/link";
import { Button } from "@/components/ui/button";
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

      {currentUser.role.slug === "merchant" && currentUser.linkedMerchantId ? (
        <div>
          <Button asChild variant="outline">
            <Link href={`/dashboard/merchants/${currentUser.linkedMerchantId}/edit`}>
              Edit Merchant Profile
            </Link>
          </Button>
        </div>
      ) : null}

      {currentUser.role.slug === "rider" && currentUser.linkedRiderId ? (
        <div>
          <Button asChild variant="outline">
            <Link href={`/dashboard/riders/${currentUser.linkedRiderId}/edit`}>
              Edit Rider Profile
            </Link>
          </Button>
        </div>
      ) : null}

      <ProfileForms
        fullName={profile.fullName}
        email={profile.email}
        phoneNumber={profile.phoneNumber}
      />
    </section>
  );
}
