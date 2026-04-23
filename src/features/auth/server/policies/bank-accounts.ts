import "server-only";
import { hasViewerPermission, isViewerSelf, type PolicyViewer } from "./shared";

export type BankAccountOwnerScope = {
    appUserId: string | null;
    isCompanyAccount: boolean;
};

function isOwnMerchantOrRiderAccount(viewer: PolicyViewer, owner: BankAccountOwnerScope) {
    return (
        !owner.isCompanyAccount &&
        (viewer.roleSlug === "merchant" || viewer.roleSlug === "rider") &&
        isViewerSelf(viewer, owner.appUserId ?? undefined)
    );
}

export function getBankAccountAccess(input: {
    viewer: PolicyViewer;
    owner: BankAccountOwnerScope;
}) {
    const { viewer, owner } = input;
    const isOwnAccount = isOwnMerchantOrRiderAccount(viewer, owner);
    const canManageCompanyAccount = owner.isCompanyAccount && viewer.roleSlug === "super_admin";

    return {
        canView: hasViewerPermission(viewer, "bank-account.view") || isOwnAccount,
        canCreate: owner.isCompanyAccount
            ? canManageCompanyAccount && hasViewerPermission(viewer, "bank-account.create")
            : hasViewerPermission(viewer, "bank-account.create") || isOwnAccount,
        canUpdate: owner.isCompanyAccount
            ? canManageCompanyAccount && hasViewerPermission(viewer, "bank-account.update")
            : hasViewerPermission(viewer, "bank-account.update") || isOwnAccount,
        canDelete: owner.isCompanyAccount
            ? canManageCompanyAccount && hasViewerPermission(viewer, "bank-account.delete")
            : hasViewerPermission(viewer, "bank-account.delete") || isOwnAccount,
    };
}
