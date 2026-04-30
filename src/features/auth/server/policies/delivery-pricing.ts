import "server-only";
import { hasViewerPermission, type PolicyViewer } from "./shared";

export function getDeliveryPricingAccess(viewer: PolicyViewer) {
    return {
        canView: hasViewerPermission(viewer, "delivery-pricing.view"),
        canCreate: hasViewerPermission(viewer, "delivery-pricing.create"),
        canUpdate: hasViewerPermission(viewer, "delivery-pricing.update"),
    };
}
