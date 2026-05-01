import "server-only";
import { hasViewerPermission, isAdminRole } from "@/features/auth/server/policies/shared";

import type { AppAccessViewer } from "@/features/auth/server/dto";

export function getAddressBookAccess(input: {
    viewer: AppAccessViewer;
    merchantAppUserId?: string | null;
}) {
    const canReachSelectedMerchant =
        input.merchantAppUserId == null
            ? input.viewer.roleSlug !== "rider"
            : isAdminRole(input.viewer.roleSlug) ||
              (input.viewer.roleSlug === "merchant" &&
                  input.viewer.appUserId === input.merchantAppUserId);

    return {
        canView: hasViewerPermission(input.viewer, "address-book.view") && canReachSelectedMerchant,
        canCreate:
            hasViewerPermission(input.viewer, "address-book.create") && canReachSelectedMerchant,
        canUpdate:
            hasViewerPermission(input.viewer, "address-book.update") && canReachSelectedMerchant,
        canDelete:
            hasViewerPermission(input.viewer, "address-book.delete") && canReachSelectedMerchant,
        canSelectMerchant: isAdminRole(input.viewer.roleSlug),
    };
}
