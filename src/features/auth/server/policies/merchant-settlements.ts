import "server-only";
import { hasViewerPermission, type PolicyViewer } from "./shared";

export function getMerchantSettlementAccess(viewer: PolicyViewer) {
    return {
        canView: hasViewerPermission(viewer, "merchant-settlement.view"),
        canCreate: hasViewerPermission(viewer, "merchant-settlement.create"),
        canConfirm: hasViewerPermission(viewer, "merchant-settlement.confirm"),
        canCancel: hasViewerPermission(viewer, "merchant-settlement.cancel"),
    };
}
