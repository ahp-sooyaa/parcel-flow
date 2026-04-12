import "server-only";
import { hasViewerPermission, type PolicyViewer } from "./shared";

export function getTownshipAccess(viewer: PolicyViewer) {
  return {
    canViewList: hasViewerPermission(viewer, "township-list.view"),
    canCreate: hasViewerPermission(viewer, "township.create"),
    canUpdate: hasViewerPermission(viewer, "township.update"),
    canDelete: hasViewerPermission(viewer, "township.delete"),
  };
}
