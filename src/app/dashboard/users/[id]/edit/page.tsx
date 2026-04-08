import { notFound } from "next/navigation";
import { IfPermitted } from "@/components/shared/if-permitted";
import { ProfileEditTabs, type ProfileEditTab } from "@/components/shared/profile-edit-tabs";
import { requirePermission } from "@/features/auth/server/utils";
import { EditMerchantForm } from "@/features/merchant/components/edit-merchant-form";
import { getMerchantById } from "@/features/merchant/server/dal";
import { EditRiderForm } from "@/features/rider/components/edit-rider-form";
import { getRiderById } from "@/features/rider/server/dal";
import { getTownshipOptions } from "@/features/townships/server/dal";
import { EditUserForm } from "@/features/users/components/edit-user-form";
import { SoftDeleteUserForm } from "@/features/users/components/soft-delete-user-form";
import { getUserById } from "@/features/users/server/dal";

type EditUserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditUserPage({ params }: Readonly<EditUserPageProps>) {
  const currentUser = await requirePermission("user.update");
  const { id } = await params;
  const user = await getUserById(id);

  if (!user) {
    notFound();
  }

  const canEditMerchantDetails = currentUser.permissions.includes("merchant.update");
  const canEditRiderDetails = currentUser.permissions.includes("rider.update");

  const shouldLoadMerchantData = user.roleSlug === "merchant" && canEditMerchantDetails;
  const shouldLoadRiderData = user.roleSlug === "rider" && canEditRiderDetails;
  const shouldLoadRoleData = shouldLoadMerchantData || shouldLoadRiderData;

  const [merchant, rider, townships] = shouldLoadRoleData
    ? await Promise.all([
        shouldLoadMerchantData ? getMerchantById(user.id) : Promise.resolve(null),
        shouldLoadRiderData ? getRiderById(user.id) : Promise.resolve(null),
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
              Update merchant-only business profile fields for this user account.
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
              Update rider-only operational profile fields for this user account.
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
            canEditOperationalStatus={currentUser.permissions.includes("rider.update")}
          />
        </div>
      ),
    };
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Edit User</h1>
        <p className="text-sm text-muted-foreground">
          Update shared app user profile data for {user.fullName}.
        </p>
      </header>

      <ProfileEditTabs
        primaryTab={{
          id: "account-details",
          label: "Account Details",
          content: (
            <div className="space-y-4">
              <header className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">Account Details</h2>
                <p className="text-xs text-muted-foreground">
                  Update shared app user profile fields and contact information.
                </p>
              </header>

              <EditUserForm
                userId={user.id}
                fullName={user.fullName}
                email={user.email}
                phoneNumber={user.phoneNumber}
                roleLabel={user.roleLabel}
              />
            </div>
          ),
        }}
        secondaryTab={secondaryTab}
      />

      <IfPermitted permission="user.delete">
        <section className="space-y-3 rounded-xl border border-destructive/30 bg-card p-5">
          <h2 className="text-lg font-semibold text-destructive">Delete User</h2>
          <p className="text-xs text-muted-foreground">
            This removes the user and any linked merchant or rider profile from normal screens. The
            record is still kept for history and audit purposes.
          </p>
          <SoftDeleteUserForm userId={user.id} />
        </section>
      </IfPermitted>
    </section>
  );
}
