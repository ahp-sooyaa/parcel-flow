import "server-only";
import { hasViewerPermission, type PolicyViewer } from "./shared";

export function getUserManagementAccess(viewer: PolicyViewer) {
    return {
        canViewList: hasViewerPermission(viewer, "user-list.view"),
        canViewTarget: hasViewerPermission(viewer, "user.view"),
        canCreate: hasViewerPermission(viewer, "user.create"),
        canUpdateTarget: hasViewerPermission(viewer, "user.update"),
        canDeleteTarget: hasViewerPermission(viewer, "user.delete"),
        canResetPasswordTarget: hasViewerPermission(viewer, "user-password.reset"),
    };
}
