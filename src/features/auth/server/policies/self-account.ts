import "server-only";
import { isViewerSelf, type PolicyViewer } from "./shared";

export function getSelfAccountAccess(input: { viewer: PolicyViewer; targetUserId?: string }) {
    const { viewer, targetUserId } = input;
    const isSelf = isViewerSelf(viewer, targetUserId);

    return {
        canViewSelf: isSelf,
        canUpdateSelf: isSelf,
        canChangeOwnPassword: isSelf,
    };
}
