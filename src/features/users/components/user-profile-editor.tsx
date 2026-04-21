import Link from "next/link";
import { ChangePasswordForm } from "./change-password-form";
import { AccountEditForm } from "./edit-user-form";
import { getBankAccountAccess } from "@/features/auth/server/policies/bank-accounts";
import { getMerchantAccess } from "@/features/auth/server/policies/merchant";
import { getRiderAccess } from "@/features/auth/server/policies/rider";
import { BankAccountsPanel } from "@/features/bank-accounts/components/bank-accounts-panel";
import { getOwnerDisplayLabel } from "@/features/bank-accounts/server/utils";
import { EditMerchantForm } from "@/features/merchant/components/edit-merchant-form";
import { getMerchantProfileByAppUserIdForViewer } from "@/features/merchant/server/dal";
import { EditRiderForm } from "@/features/rider/components/edit-rider-form";
import { getRiderProfileByAppUserIdForViewer } from "@/features/rider/server/dal";
import { getTownshipOptions } from "@/features/townships/server/dal";
import { cn } from "@/lib/utils";

import type { AppAccessContext } from "@/features/auth/server/dto";

type EditorMode = "self" | "admin";
type ProfileEditorUser = Pick<
    AppAccessContext,
    "appUserId" | "fullName" | "email" | "phoneNumber" | "roleSlug"
>;

type UserProfileEditorProps = {
    viewer: AppAccessContext;
    mode: EditorMode;
    activeTab?: string;
    basePath: string;
    targetUser?: ProfileEditorUser;
};

export async function UserProfileEditor({
    viewer,
    mode,
    activeTab = "account-details",
    basePath,
    targetUser,
}: Readonly<UserProfileEditorProps>) {
    const accountUser =
        mode === "self"
            ? {
                  appUserId: viewer.appUserId,
                  fullName: viewer.fullName,
                  email: viewer.email,
                  phoneNumber: viewer.phoneNumber,
                  roleSlug: viewer.roleSlug,
              }
            : targetUser;

    if (!accountUser) {
        throw new Error("Target user is required for admin profile editing.");
    }

    const targetUserId = accountUser.appUserId;
    let canEditMerchantDetails = false;
    let canEditRiderDetails = false;
    let merchantProfile: Awaited<ReturnType<typeof getMerchantProfileByAppUserIdForViewer>> = null;
    let riderProfile: Awaited<ReturnType<typeof getRiderProfileByAppUserIdForViewer>> = null;
    let townships: Awaited<ReturnType<typeof getTownshipOptions>> = [];
    const bankAccountOwner =
        accountUser.roleSlug === "super_admin"
            ? {
                  appUserId: null,
                  isCompanyAccount: true,
              }
            : accountUser.roleSlug === "merchant" || accountUser.roleSlug === "rider"
              ? {
                    appUserId: targetUserId,
                    isCompanyAccount: false,
                }
              : null;
    const bankAccountAccess = bankAccountOwner
        ? getBankAccountAccess({
              viewer,
              owner: bankAccountOwner,
          })
        : null;
    const canViewBankAccounts = bankAccountAccess?.canView ?? false;

    canEditMerchantDetails = getMerchantAccess({
        viewer,
        merchantAppUserId: targetUserId,
    }).canUpdate;
    canEditRiderDetails = getRiderAccess({
        viewer,
        riderAppUserId: targetUserId,
    }).canUpdate;

    if (canEditMerchantDetails) {
        merchantProfile = await getMerchantProfileByAppUserIdForViewer(viewer, targetUserId);
    }

    if (canEditRiderDetails) {
        riderProfile = await getRiderProfileByAppUserIdForViewer(viewer, targetUserId);
    }

    if (canEditMerchantDetails || canEditRiderDetails) {
        townships = await getTownshipOptions();
    }

    return (
        <section className="space-y-4">
            <nav
                className="flex items-center gap-1 overflow-x-auto border-b"
                aria-label="Profile edit tabs"
            >
                <Link
                    href={`${basePath}?tab=account-details`}
                    className={cn("border-b-2 px-4 py-2 text-sm font-medium transition-colors", {
                        "border-primary text-foreground": activeTab === "account-details",
                        "border-transparent text-muted-foreground hover:text-foreground":
                            activeTab !== "account-details",
                    })}
                >
                    Account Details
                </Link>

                {merchantProfile && (
                    <Link
                        href={`${basePath}?tab=merchant-details`}
                        className={cn(
                            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                            {
                                "border-primary text-foreground": activeTab === "merchant-details",
                                "border-transparent text-muted-foreground hover:text-foreground":
                                    activeTab !== "merchant-details",
                            },
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
                            {
                                "border-primary text-foreground": activeTab === "rider-details",
                                "border-transparent text-muted-foreground hover:text-foreground":
                                    activeTab !== "rider-details",
                            },
                        )}
                    >
                        Rider Details
                    </Link>
                )}

                {canViewBankAccounts && (
                    <Link
                        href={`${basePath}?tab=bank-accounts`}
                        className={cn(
                            "border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                            {
                                "border-primary text-foreground": activeTab === "bank-accounts",
                                "border-transparent text-muted-foreground hover:text-foreground":
                                    activeTab !== "bank-accounts",
                            },
                        )}
                    >
                        Bank Accounts
                    </Link>
                )}
            </nav>

            <section className="rounded-xl border bg-card p-6">
                {activeTab === "account-details" && (
                    <div className="space-y-6">
                        <section className="space-y-4">
                            <header className="space-y-1">
                                <h2 className="text-lg font-semibold tracking-tight">
                                    Account Details
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    {mode === "admin"
                                        ? "Update shared app user profile fields and contact information."
                                        : "Update your own profile contact details."}
                                </p>
                            </header>

                            <AccountEditForm
                                user={accountUser}
                                mode={mode}
                                submitLabel={
                                    mode === "admin" ? "Save User Profile" : "Save Profile"
                                }
                            />
                        </section>

                        {mode === "self" && (
                            <section className="space-y-4 border-t pt-5">
                                <header>
                                    <h2 className="text-lg font-semibold">Security</h2>
                                    <p className="text-xs text-muted-foreground">
                                        Change your own password.
                                    </p>
                                </header>
                                <ChangePasswordForm />
                            </section>
                        )}
                    </div>
                )}

                {activeTab === "merchant-details" && merchantProfile && (
                    <div className="space-y-4">
                        <header className="space-y-1">
                            <h2 className="text-lg font-semibold tracking-tight">
                                Merchant Details
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                {mode === "admin"
                                    ? "Update merchant-only business profile fields for this user account."
                                    : "Update your merchant-only business profile fields."}
                            </p>
                        </header>

                        <EditMerchantForm
                            merchant={{
                                merchantId: merchantProfile.appUserId,
                                shopName: merchantProfile.shopName,
                                townshipId: merchantProfile.pickupTownshipId,
                                defaultPickupAddress: merchantProfile.defaultPickupAddress,
                                notes: merchantProfile.notes,
                            }}
                            contact={{
                                contactName: accountUser.fullName,
                                email: accountUser.email,
                                phoneNumber: accountUser.phoneNumber,
                            }}
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
                            rider={{
                                riderId: riderProfile.appUserId,
                                townshipId: riderProfile.townshipId,
                                vehicleType: riderProfile.vehicleType,
                                licensePlate: riderProfile.licensePlate,
                                isActive: riderProfile.isActive,
                                notes: riderProfile.notes,
                            }}
                            contact={{
                                fullName: accountUser.fullName,
                                email: accountUser.email,
                                phoneNumber: accountUser.phoneNumber,
                            }}
                            townships={townships}
                            permissions={{
                                canEditOperationalStatus:
                                    mode === "admin" && viewer.permissions.includes("rider.update"),
                            }}
                        />
                    </div>
                )}

                {activeTab === "bank-accounts" && bankAccountOwner && canViewBankAccounts && (
                    <BankAccountsPanel
                        viewer={viewer}
                        owner={bankAccountOwner}
                        title={getOwnerDisplayLabel({
                            roleSlug: accountUser.roleSlug,
                            fullName: accountUser.fullName,
                        })}
                        description={
                            bankAccountOwner.isCompanyAccount
                                ? bankAccountAccess?.canCreate || bankAccountAccess?.canUpdate
                                    ? "Manage shared company bank accounts used for internal settlement workflows."
                                    : "View shared company bank accounts used for internal settlement workflows."
                                : mode === "admin"
                                  ? "View or manage this user's bank accounts based on your permissions."
                                  : "Manage your own bank accounts for settlement and payout workflows."
                        }
                        basePath={basePath}
                    />
                )}
            </section>
        </section>
    );
}
