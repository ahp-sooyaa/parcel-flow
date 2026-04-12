import "server-only";
import { hasViewerPermission, isViewerSelf, type PolicyViewer } from "./shared";
import {
  type ParcelUpdateInput,
  type RiderNextAction,
  getNextRiderParcelAction,
} from "@/features/parcels/server/utils";

type ParcelTarget = {
  merchantId?: string | null;
  riderId?: string | null;
};

type ParcelUpdateCurrent = {
  parcel: {
    merchantId: string;
    riderId: string | null;
    status: ParcelUpdateInput["parcelStatus"];
  };
  payment: {
    deliveryFeeStatus: ParcelUpdateInput["deliveryFeeStatus"];
    codStatus: ParcelUpdateInput["codStatus"];
    collectedAmount: string;
    collectionStatus: ParcelUpdateInput["collectionStatus"];
    merchantSettlementStatus: ParcelUpdateInput["merchantSettlementStatus"];
    riderPayoutStatus: ParcelUpdateInput["riderPayoutStatus"];
    note: string | null;
  };
};

export function getParcelAccess(input: { viewer: PolicyViewer; parcel?: ParcelTarget }) {
  const { viewer, parcel } = input;
  const isRelatedMerchant =
    viewer.roleSlug === "merchant" && isViewerSelf(viewer, parcel?.merchantId ?? undefined);
  const isAssignedRider =
    viewer.roleSlug === "rider" && isViewerSelf(viewer, parcel?.riderId ?? undefined);

  return {
    canViewList: hasViewerPermission(viewer, "parcel-list.view"),
    canCreate: hasViewerPermission(viewer, "parcel.create"),
    canView: hasViewerPermission(viewer, "parcel.view") || isRelatedMerchant || isAssignedRider,
    canUpdate: hasViewerPermission(viewer, "parcel.update") || isRelatedMerchant,
    canDelete: hasViewerPermission(viewer, "parcel.delete"),
  };
}

export function getRiderParcelActionAccess(input: {
  viewer: PolicyViewer;
  parcel?: Pick<ParcelTarget, "riderId">;
}) {
  const { viewer, parcel } = input;
  const isAssignedRider =
    viewer.roleSlug === "rider" && isViewerSelf(viewer, parcel?.riderId ?? undefined);

  return {
    canViewAssignedParcel: isAssignedRider,
    canProgressStatus: isAssignedRider,
    canUploadProofOfDelivery: isAssignedRider,
  };
}

export function authorizeParcelCreate(input: {
  viewer: PolicyViewer;
  submittedMerchantId: string;
}) {
  if (input.viewer.roleSlug !== "merchant") {
    return {
      ok: true as const,
      merchantId: input.submittedMerchantId,
    };
  }

  if (input.submittedMerchantId !== input.viewer.appUserId) {
    return {
      ok: false as const,
      message: "Merchant users can only manage parcels for their own merchant profile.",
    };
  }

  return {
    ok: true as const,
    merchantId: input.viewer.appUserId,
  };
}

export function authorizeParcelUpdate(input: {
  viewer: PolicyViewer;
  submitted: ParcelUpdateInput;
  current: ParcelUpdateCurrent;
}) {
  const parcelAccess = getParcelAccess({
    viewer: input.viewer,
    parcel: {
      merchantId: input.current.parcel.merchantId,
      riderId: input.current.parcel.riderId,
    },
  });

  if (!parcelAccess.canUpdate) {
    return {
      ok: false as const,
      message: "You are not allowed to update parcels.",
    };
  }

  if (input.viewer.roleSlug !== "merchant") {
    return {
      ok: true as const,
      authorized: {
        merchantId: input.submitted.merchantId,
        riderId: input.submitted.riderId,
        parcelStatus: input.submitted.parcelStatus,
        deliveryFeeStatus: input.submitted.deliveryFeeStatus,
        codStatus: input.submitted.codStatus,
        collectedAmount: input.submitted.collectedAmount,
        collectionStatus: input.submitted.collectionStatus,
        merchantSettlementStatus: input.submitted.merchantSettlementStatus,
        riderPayoutStatus: input.submitted.riderPayoutStatus,
        paymentNote: input.submitted.paymentNote,
      },
    };
  }

  if (input.submitted.merchantId !== input.current.parcel.merchantId) {
    return {
      ok: false as const,
      message: "Merchant users can only manage parcels for their own merchant profile.",
    };
  }

  return {
    ok: true as const,
    authorized: {
      merchantId: input.current.parcel.merchantId,
      riderId: input.current.parcel.riderId,
      parcelStatus: input.current.parcel.status,
      deliveryFeeStatus: input.current.payment.deliveryFeeStatus,
      codStatus: input.current.payment.codStatus,
      collectedAmount: Number(input.current.payment.collectedAmount),
      collectionStatus: input.current.payment.collectionStatus,
      merchantSettlementStatus: input.current.payment.merchantSettlementStatus,
      riderPayoutStatus: input.current.payment.riderPayoutStatus,
      paymentNote: input.current.payment.note,
    },
  };
}

export function getNextAssignedRiderAction(input: {
  viewer: PolicyViewer;
  parcel: {
    riderId: string | null;
    status: ParcelUpdateInput["parcelStatus"];
  };
}): RiderNextAction | null {
  const riderAccess = getRiderParcelActionAccess({
    viewer: input.viewer,
    parcel: {
      riderId: input.parcel.riderId,
    },
  });

  if (!riderAccess.canProgressStatus) {
    return null;
  }

  return getNextRiderParcelAction(input.parcel.status);
}
