import "server-only";
import { hasViewerPermission, isViewerSelf, type PolicyViewer } from "./shared";

export function getMerchantAccess(input: { viewer: PolicyViewer; merchantAppUserId?: string }) {
  const { viewer, merchantAppUserId } = input;
  const isOwnMerchant = viewer.roleSlug === "merchant" && isViewerSelf(viewer, merchantAppUserId);

  return {
    canViewList: hasViewerPermission(viewer, "merchant-list.view"),
    canCreate: hasViewerPermission(viewer, "user.create"),
    canView: hasViewerPermission(viewer, "merchant.view") || isOwnMerchant,
    canUpdate: hasViewerPermission(viewer, "merchant.update") || isOwnMerchant,
    canDelete: hasViewerPermission(viewer, "merchant.delete"),
  };
}
