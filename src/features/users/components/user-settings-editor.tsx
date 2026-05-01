import Link from "next/link";
import { ChangePasswordForm } from "./change-password-form";
import { AccountEditForm } from "./edit-user-form";
import { ResetUserPasswordForm } from "./reset-user-password-form";
import { UserStatusForm } from "./user-status-form";
import { getBankAccountAccess } from "@/features/auth/server/policies/bank-accounts";
import { getMerchantAccess } from "@/features/auth/server/policies/merchant";
import { getRiderAccess } from "@/features/auth/server/policies/rider";
import { getUserManagementAccess } from "@/features/auth/server/policies/user-management";
import { BankAccountsPanel } from "@/features/bank-accounts/components/bank-accounts-panel";
import {
    getOwnerDisplayLabel,
    isBankAccountUserOwnerRole,
} from "@/features/bank-accounts/server/utils";
import { EditMerchantForm } from "@/features/merchant/components/edit-merchant-form";
import { getMerchantProfileByAppUserIdForViewer } from "@/features/merchant/server/dal";
import { EditRiderForm } from "@/features/rider/components/edit-rider-form";
import { getRiderProfileByAppUserIdForViewer } from "@/features/rider/server/dal";
import { getTownshipOptions } from "@/features/townships/server/dal";
import { cn } from "@/lib/utils";

import type { AppAccessContext } from "@/features/auth/server/dto";
import type { BankAccountOwnerDto } from "@/features/bank-accounts/server/dto";

type EditorMode = "self" | "admin";
type SettingsEditorUser = Pick<
    AppAccessContext,
    | "appUserId"
    | "fullName"
    | "email"
    | "phoneNumber"
    | "roleSlug"
    | "isActive"
    | "mustResetPassword"
>;

type UserSettingsEditorProps = {
    viewer: AppAccessContext;
    mode: EditorMode;
    activeTab?: string;
    basePath: string;
    targetUser?: SettingsEditorUser;
};

function getSettingsBankAccountOwner(user: SettingsEditorUser): BankAccountOwnerDto | null {
    if (user.roleSlug === "super_admin") {
        return {
            appUserId: null,
            isCompanyAccount: true,
        };
    }

    if (isBankAccountUserOwnerRole(user.roleSlug)) {
        return {
            appUserId: user.appUserId,
            isCompanyAccount: false,
        };
    }

    return null;
}

function getBankAccountDescription(input: {
    owner: BankAccountOwnerDto;
    mode: EditorMode;
    canManage: boolean;
}) {
    if (input.owner.isCompanyAccount) {
        return input.canManage
            ? "Manage shared company bank accounts used for internal settlement workflows."
            : "View shared company bank accounts used for internal settlement workflows.";
    }

    if (input.mode === "admin") {
        return "View or manage this user's bank accounts based on your permissions.";
    }

    return "Manage your own bank accounts for settlement and payout workflows.";
}

export async function UserSettingsEditor({
    viewer,
    mode,
    activeTab = "account-details",
    basePath,
    targetUser,
}: Readonly<UserSettingsEditorProps>) {
    const accountUser =
        mode === "self"
            ? {
                  appUserId: viewer.appUserId,
                  fullName: viewer.fullName,
                  email: viewer.email,
                  phoneNumber: viewer.phoneNumber,
                  roleSlug: viewer.roleSlug,
                  isActive: viewer.isActive,
                  mustResetPassword: viewer.mustResetPassword,
              }
            : targetUser;

    if (!accountUser) {
        throw new Error("Target user is required for admin settings editing.");
    }

    const targetUserId = accountUser.appUserId;
    const userManagementAccess = getUserManagementAccess(viewer);
    let canEditMerchantDetails = false;
    let canEditRiderDetails = false;
    let merchantProfile: Awaited<ReturnType<typeof getMerchantProfileByAppUserIdForViewer>> = null;
    let riderProfile: Awaited<ReturnType<typeof getRiderProfileByAppUserIdForViewer>> = null;
    let townships: Awaited<ReturnType<typeof getTownshipOptions>> = [];
    const bankAccountOwner = getSettingsBankAccountOwner(accountUser);
    const bankAccountAccess = bankAccountOwner
        ? getBankAccountAccess({
              viewer,
              owner: bankAccountOwner,
          })
        : null;
    const canViewBankAccounts = bankAccountAccess?.canView ?? false;
    const canManageBankAccounts = Boolean(
        bankAccountAccess?.canCreate || bankAccountAccess?.canUpdate,
    );
    const bankAccountDescription = bankAccountOwner
        ? getBankAccountDescription({
              owner: bankAccountOwner,
              mode,
              canManage: canManageBankAccounts,
          })
        : "";

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

    if (canEditRiderDetails) {
        townships = await getTownshipOptions();
    }

    return (
        <section className="space-y-4">
            <nav
                className="flex items-center gap-1 overflow-x-auto border-b"
                aria-label="Settings tabs"
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
                                        ? "Update shared app user account fields and contact information."
                                        : "Update your own account contact details."}
                                </p>
                            </header>

                            <AccountEditForm
                                user={accountUser}
                                mode={mode}
                                submitLabel="Save Account Details"
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

                        {mode === "admin" && userManagementAccess.canUpdateTarget && (
                            <section className="space-y-4 border-t pt-5">
                                <UserStatusForm
                                    userId={accountUser.appUserId}
                                    initialIsActive={accountUser.isActive}
                                />
                            </section>
                        )}

                        {mode === "admin" && userManagementAccess.canResetPasswordTarget && (
                            <section className="space-y-4 border-t pt-5">
                                <header className="space-y-1">
                                    <h2 className="text-lg font-semibold">Account Recovery</h2>
                                    <p className="text-xs text-muted-foreground">
                                        Generate a one-time temporary password for account access
                                        recovery.
                                    </p>
                                </header>

                                <ResetUserPasswordForm
                                    userId={accountUser.appUserId}
                                    initialMustResetPassword={accountUser.mustResetPassword}
                                />
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
                                    ? "Update merchant-only business details for this user account."
                                    : "Update your merchant-only business details."}
                            </p>
                        </header>

                        <EditMerchantForm
                            merchant={{
                                merchantId: merchantProfile.appUserId,
                                shopName: merchantProfile.shopName,
                                notes: merchantProfile.notes,
                            }}
                            contact={{
                                contactName: accountUser.fullName,
                                email: accountUser.email,
                                phoneNumber: accountUser.phoneNumber,
                            }}
                        />
                    </div>
                )}

                {activeTab === "rider-details" && riderProfile && (
                    <div className="space-y-4">
                        <header className="space-y-1">
                            <h2 className="text-lg font-semibold tracking-tight">Rider Details</h2>
                            <p className="text-xs text-muted-foreground">
                                {mode === "admin"
                                    ? "Update rider-only operational details for this user account."
                                    : "Update your rider-only operational details."}
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
                        description={bankAccountDescription}
                        basePath={basePath}
                    />
                )}
            </section>
        </section>
    );
}
