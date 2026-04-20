import "server-only";
import { hasViewerPermission, isViewerSelf, type PolicyViewer } from "./shared";

export function getRiderAccess(input: { viewer: PolicyViewer; riderAppUserId?: string }) {
    const { viewer, riderAppUserId } = input;
    const isOwnRider = viewer.roleSlug === "rider" && isViewerSelf(viewer, riderAppUserId);
    const canManageStatus = hasViewerPermission(viewer, "rider.update");

    return {
        canViewList: hasViewerPermission(viewer, "rider-list.view"),
        canCreate: hasViewerPermission(viewer, "user.create"),
        canView: hasViewerPermission(viewer, "rider.view") || isOwnRider,
        canUpdate: canManageStatus || isOwnRider,
        canManageStatus,
        canDelete: hasViewerPermission(viewer, "rider.delete"),
    };
}
