import Link from "next/link";
import { ChangePasswordForm } from "./change-password-form";
import { AccountEditForm } from "./edit-user-form";
import { EditMerchantForm } from "@/features/merchant/components/edit-merchant-form";
import { getMerchantById } from "@/features/merchant/server/dal";
import { EditRiderForm } from "@/features/rider/components/edit-rider-form";
import { getRiderById } from "@/features/rider/server/dal";
import { getTownshipOptions } from "@/features/townships/server/dal";
import { cn } from "@/lib/utils";

import type { PermissionSlug, RoleSlug } from "@/db/constants";

type EditorMode = "self" | "admin";

type UserProfileEditorViewer = {
  appUserId: string;
  roleSlug: RoleSlug;
  permissions: readonly PermissionSlug[];
  linkedMerchantId: string | null;
  linkedRiderId: string | null;
};

type UserProfileEditorTarget = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  roleSlug: RoleSlug;
  roleLabel: string;
};

type UserProfileEditorProps = {
  viewer: UserProfileEditorViewer;
  targetUser: UserProfileEditorTarget;
  mode: EditorMode;
  activeTab?: string;
  basePath: string;
};

export async function UserProfileEditor({
  viewer,
  targetUser,
  mode,
  activeTab,
  basePath,
}: Readonly<UserProfileEditorProps>) {
  const canEditMerchantDetails =
    targetUser.roleSlug === "merchant" &&
    (mode === "admin"
      ? viewer.permissions.includes("merchant.update")
      : viewer.roleSlug === "merchant" && viewer.linkedMerchantId === targetUser.id);

  const canEditRiderDetails =
    targetUser.roleSlug === "rider" &&
    (mode === "admin"
      ? viewer.permissions.includes("rider.update")
      : viewer.roleSlug === "rider" && viewer.linkedRiderId === targetUser.id);

  let merchantProfile: Awaited<ReturnType<typeof getMerchantById>> = null;
  let riderProfile: Awaited<ReturnType<typeof getRiderById>> = null;
  let townships: Awaited<ReturnType<typeof getTownshipOptions>> = [];

  if (canEditMerchantDetails) {
    merchantProfile = await getMerchantById(targetUser.id);

    if (merchantProfile) {
      townships = await getTownshipOptions();
    }
  }

  if (canEditRiderDetails) {
    riderProfile = await getRiderById(targetUser.id);

    if (riderProfile) {
      townships = await getTownshipOptions();
    }
  }

  return (
    <section className="space-y-4">
      <nav className="flex items-center gap-1 border-b" aria-label="Profile edit tabs">
        <Link
          href={`${basePath}?tab=account-details`}
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "account-details"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Account Details
        </Link>

        {merchantProfile && (
          <Link
            href={`${basePath}?tab=merchant-details`}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "merchant-details"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Merchant Details
          </Link>
        )}

        {riderProfile && (
          <Link
            href={`${basePath}?tab=rider-details`}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "rider-details"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Rider Details
          </Link>
        )}
      </nav>

      <section className="rounded-xl border bg-card p-6">
        {activeTab === "account-details" && (
          <div className="space-y-6">
            <section className="space-y-4">
              <header className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight">Account Details</h2>
                <p className="text-xs text-muted-foreground">
                  {mode === "admin"
                    ? "Update shared app user profile fields and contact information."
                    : "Update your own profile contact details."}
                </p>
              </header>

              <AccountEditForm
                targetUserId={mode === "admin" ? targetUser.id : undefined}
                fullName={targetUser.fullName}
                email={targetUser.email}
                phoneNumber={targetUser.phoneNumber}
                showRole={mode === "admin"}
                roleLabel={targetUser.roleLabel}
                submitLabel={mode === "admin" ? "Save User Profile" : "Save Profile"}
              />
            </section>

            {mode === "self" && (
              <section className="space-y-4 border-t pt-5">
                <header>
                  <h2 className="text-lg font-semibold">Security</h2>
                  <p className="text-xs text-muted-foreground">Change your own password.</p>
                </header>
                <ChangePasswordForm />
              </section>
            )}
          </div>
        )}

        {activeTab === "merchant-details" && merchantProfile && (
          <div className="space-y-4">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Merchant Details</h2>
              <p className="text-xs text-muted-foreground">
                {mode === "admin"
                  ? "Update merchant-only business profile fields for this user account."
                  : "Update your merchant-only business profile fields."}
              </p>
            </header>

            <EditMerchantForm
              merchantId={merchantProfile.id}
              shopName={merchantProfile.shopName}
              contactName={merchantProfile.contactName}
              email={merchantProfile.email}
              phoneNumber={merchantProfile.phoneNumber}
              townshipId={merchantProfile.pickupTownshipId}
              defaultPickupAddress={merchantProfile.defaultPickupAddress}
              notes={merchantProfile.notes}
              townships={townships}
            />
          </div>
        )}

        {activeTab === "rider-details" && riderProfile && (
          <div className="space-y-4">
            <header className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Rider Details</h2>
              <p className="text-xs text-muted-foreground">
                {mode === "admin"
                  ? "Update rider-only operational profile fields for this user account."
                  : "Update your rider-only operational profile fields."}
              </p>
            </header>

            <EditRiderForm
              riderId={riderProfile.id}
              fullName={riderProfile.fullName}
              email={riderProfile.email}
              phoneNumber={riderProfile.phoneNumber}
              townshipId={riderProfile.townshipId}
              vehicleType={riderProfile.vehicleType}
              licensePlate={riderProfile.licensePlate}
              isActive={riderProfile.isActive}
              notes={riderProfile.notes}
              townships={townships}
              canEditOperationalStatus={
                mode === "admin" && viewer.permissions.includes("rider.update")
              }
            />
          </div>
        )}
      </section>
    </section>
  );
}
