import "server-only";
import type { PermissionSlug, RoleSlug } from "@/db/constants";
import type { AppAccessViewer } from "@/features/auth/server/dto";

export type PolicyViewer = AppAccessViewer;

export function hasViewerPermission(viewer: PolicyViewer, permission: PermissionSlug) {
    return viewer.permissions.includes(permission);
}

export function isAdminRole(roleSlug: RoleSlug) {
    return roleSlug === "super_admin" || roleSlug === "office_admin";
}

export function isViewerSelf(viewer: PolicyViewer, targetUserId?: string) {
    return typeof targetUserId === "string" && viewer.appUserId === targetUserId;
}
