import { ProfileEditTabs, type ProfileEditTab } from "@/components/shared/profile-edit-tabs";
import { requireCurrentUser } from "@/features/auth/server/utils";
import { EditMerchantForm } from "@/features/merchant/components/edit-merchant-form";
import { getMerchantById } from "@/features/merchant/server/dal";
import { ChangePasswordForm, OwnProfileForm } from "@/features/profile/components/profile-forms";
import { getProfileByAppUserId } from "@/features/profile/server/dal";
import { EditRiderForm } from "@/features/rider/components/edit-rider-form";
import { getRiderById } from "@/features/rider/server/dal";
import { getTownshipOptions } from "@/features/townships/server/dal";

export default async function ProfilePage() {
  const currentUser = await requireCurrentUser();
  const profile = await getProfileByAppUserId(currentUser.appUserId);

  if (!profile) {
    throw new Error("Profile not found.");
  }

  const shouldLoadMerchantData =
    currentUser.role.slug === "merchant" && Boolean(currentUser.linkedMerchantId);
  const shouldLoadRiderData =
    currentUser.role.slug === "rider" && Boolean(currentUser.linkedRiderId);
  const shouldLoadRoleData = shouldLoadMerchantData || shouldLoadRiderData;

  const [merchant, rider, townships] = shouldLoadRoleData
    ? await Promise.all([
        shouldLoadMerchantData && currentUser.linkedMerchantId
          ? getMerchantById(currentUser.linkedMerchantId)
          : Promise.resolve(null),
        shouldLoadRiderData && currentUser.linkedRiderId
          ? getRiderById(currentUser.linkedRiderId)
          : Promise.resolve(null),
        getTownshipOptions(),
      ])
    : [null, null, []];

  let secondaryTab: ProfileEditTab | null = null;

  if (shouldLoadMerchantData && merchant) {
    secondaryTab = {
      id: "merchant-details",
      label: "Merchant Details",
      content: (
        <div className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Merchant Details</h2>
            <p className="text-xs text-muted-foreground">
              Update your merchant-only business profile fields.
            </p>
          </header>

          <EditMerchantForm
            merchantId={merchant.id}
            shopName={merchant.shopName}
            contactName={merchant.contactName}
            email={merchant.email}
            phoneNumber={merchant.phoneNumber}
            townshipId={merchant.pickupTownshipId}
            defaultPickupAddress={merchant.defaultPickupAddress}
            notes={merchant.notes}
            townships={townships}
          />
        </div>
      ),
    };
  }

  if (shouldLoadRiderData && rider) {
    secondaryTab = {
      id: "rider-details",
      label: "Rider Details",
      content: (
        <div className="space-y-4">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Rider Details</h2>
            <p className="text-xs text-muted-foreground">
              Update your rider-only operational profile fields.
            </p>
          </header>

          <EditRiderForm
            riderId={rider.id}
            fullName={rider.fullName}
            email={rider.email}
            phoneNumber={rider.phoneNumber}
            townshipId={rider.townshipId}
            vehicleType={rider.vehicleType}
            licensePlate={rider.licensePlate}
            isActive={rider.isActive}
            notes={rider.notes}
            townships={townships}
            canEditOperationalStatus={false}
          />
        </div>
      ),
    };
  }

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your own account details and security settings.
        </p>
      </header>

      <ProfileEditTabs
        primaryTab={{
          id: "account-details",
          label: "Account Details",
          content: (
            <div className="space-y-6">
              <section className="space-y-4">
                <header>
                  <h2 className="text-lg font-semibold">Account Profile</h2>
                  <p className="text-xs text-muted-foreground">
                    Update your own profile contact details.
                  </p>
                </header>
                <OwnProfileForm
                  fullName={profile.fullName}
                  email={profile.email}
                  phoneNumber={profile.phoneNumber}
                />
              </section>

              <section className="space-y-4 border-t pt-5">
                <header>
                  <h2 className="text-lg font-semibold">Security</h2>
                  <p className="text-xs text-muted-foreground">Change your own password.</p>
                </header>
                <ChangePasswordForm />
              </section>
            </div>
          ),
        }}
        secondaryTab={secondaryTab}
      />
    </section>
  );
}
