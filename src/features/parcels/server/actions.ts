"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import {
  buildParcelPatch,
  buildPaymentPatch,
  createParcelWithPaymentAndAudit,
  getParcelUpdateContextForViewer,
  isParcelCodeInUse,
  updateParcelAndPaymentWithAudit,
} from "./dal";
import {
  advanceRiderParcelSchema,
  createParcelSchema,
  DEFAULT_CREATE_PARCEL_STATE,
  generateParcelCode,
  getDefaultCreateCodStatus,
  updateParcelSchema,
  validateParcelSubmission,
} from "./utils";
import {
  authorizeParcelCreate,
  authorizeParcelUpdate,
  getNextAssignedRiderAction,
  getRiderParcelActionAccess,
} from "@/features/auth/server/policies/parcels";
import { requireAppAccessContext, requirePermission } from "@/features/auth/server/utils";
import { computeTotalAmountToCollect, toMoneyString } from "@/features/parcels/server/utils";

import type { CreateParcelActionResult, UpdateParcelActionResult } from "./dto";

async function generateUniqueParcelCode(maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateParcelCode();
    const alreadyUsed = await isParcelCodeInUse(code);

    if (!alreadyUsed) {
      return code;
    }
  }

  throw new Error("Could not generate unique parcel code.");
}

function revalidateParcelPaths(input: {
  parcelId: string;
  merchantIds?: Array<string | null | undefined>;
  riderIds?: Array<string | null | undefined>;
}) {
  revalidatePath("/dashboard/parcels");
  revalidatePath(`/dashboard/parcels/${input.parcelId}`);
  revalidatePath(`/dashboard/parcels/${input.parcelId}/edit`);

  const merchantIds = new Set(
    (input.merchantIds ?? []).filter((merchantId): merchantId is string => Boolean(merchantId)),
  );

  for (const merchantId of merchantIds) {
    revalidatePath(`/dashboard/merchants/${merchantId}`);
  }

  const riderIds = new Set(
    (input.riderIds ?? []).filter((riderId): riderId is string => Boolean(riderId)),
  );

  for (const riderId of riderIds) {
    revalidatePath(`/dashboard/riders/${riderId}`);
  }
}

export async function createParcelAction(
  _prevState: CreateParcelActionResult,
  formData: FormData,
): Promise<CreateParcelActionResult> {
  const rawFormData = Object.fromEntries(formData.entries());
  const submittedFields = rawFormData as Record<string, string>;

  try {
    const currentUser = await requirePermission("parcel.create");

    const parsed = createParcelSchema.safeParse(rawFormData);

    if (!parsed.success) {
      return {
        ok: false,
        message: "Please provide valid parcel and payment details.",
        fields: submittedFields,
      };
    }

    const createAuthorization = authorizeParcelCreate({
      viewer: currentUser,
      submittedMerchantId: parsed.data.merchantId,
    });

    if (!createAuthorization.ok) {
      return { ok: false, message: createAuthorization.message, fields: submittedFields };
    }

    const createCodStatus = getDefaultCreateCodStatus(parsed.data.parcelType);

    const submissionGuard = await validateParcelSubmission({
      merchantId: createAuthorization.merchantId,
      riderId: parsed.data.riderId,
      recipientTownshipId: parsed.data.recipientTownshipId,
      parcelType: parsed.data.parcelType,
      codAmount: parsed.data.codAmount,
      deliveryFee: parsed.data.deliveryFee,
      codStatus: createCodStatus,
    });

    if (!submissionGuard.ok) {
      return { ok: false, message: submissionGuard.message, fields: submittedFields };
    }

    const parcelCode = await generateUniqueParcelCode();

    const totalAmountToCollect = computeTotalAmountToCollect({
      parcelType: parsed.data.parcelType,
      codAmount: parsed.data.codAmount,
      deliveryFee: parsed.data.deliveryFee,
      deliveryFeePayer: parsed.data.deliveryFeePayer,
    });

    const created = await createParcelWithPaymentAndAudit({
      actorAppUserId: currentUser.appUserId,
      parcelValues: {
        parcelCode,
        merchantId: createAuthorization.merchantId,
        riderId: parsed.data.riderId,
        recipientName: parsed.data.recipientName,
        recipientPhone: parsed.data.recipientPhone,
        recipientTownshipId: parsed.data.recipientTownshipId,
        recipientAddress: parsed.data.recipientAddress,
        parcelType: parsed.data.parcelType,
        codAmount: toMoneyString(parsed.data.parcelType === "cod" ? parsed.data.codAmount : 0),
        deliveryFee: toMoneyString(parsed.data.deliveryFee),
        totalAmountToCollect: toMoneyString(totalAmountToCollect),
        deliveryFeePayer: parsed.data.deliveryFeePayer,
        status: DEFAULT_CREATE_PARCEL_STATE.parcelStatus,
      },
      paymentValues: {
        deliveryFeeStatus: DEFAULT_CREATE_PARCEL_STATE.deliveryFeeStatus,
        codStatus: createCodStatus,
        collectedAmount: "0.00",
        collectionStatus: DEFAULT_CREATE_PARCEL_STATE.collectionStatus,
        merchantSettlementStatus: DEFAULT_CREATE_PARCEL_STATE.merchantSettlementStatus,
        riderPayoutStatus: DEFAULT_CREATE_PARCEL_STATE.riderPayoutStatus,
        note: parsed.data.paymentNote,
      },
    });

    revalidateParcelPaths({
      parcelId: created.parcelId,
      merchantIds: [createAuthorization.merchantId],
      riderIds: [parsed.data.riderId],
    });

    return {
      ok: true,
      message: "Parcel created successfully.",
      parcelId: created.parcelId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create parcel.";

    return { ok: false, message, fields: submittedFields };
  }
}

export async function updateParcelAction(
  _prevState: UpdateParcelActionResult,
  formData: FormData,
): Promise<UpdateParcelActionResult> {
  const rawFormData = Object.fromEntries(formData.entries());
  const submittedFields = rawFormData as Record<string, string>;

  try {
    const currentUser = await requireAppAccessContext();

    const parsed = updateParcelSchema.safeParse(rawFormData);

    if (!parsed.success) {
      return {
        ok: false,
        message: "Please provide valid parcel and payment update details.",
        fields: submittedFields,
      };
    }

    const current = await getParcelUpdateContextForViewer(currentUser, parsed.data.parcelId);

    if (!current) {
      return { ok: false, message: "Parcel was not found.", fields: submittedFields };
    }

    const updateAuthorization = authorizeParcelUpdate({
      viewer: currentUser,
      submitted: parsed.data,
      current,
    });

    if (!updateAuthorization.ok) {
      return { ok: false, message: updateAuthorization.message, fields: submittedFields };
    }

    const actorScopedUpdate = updateAuthorization.authorized;

    const submissionGuard = await validateParcelSubmission({
      merchantId: actorScopedUpdate.merchantId,
      riderId: actorScopedUpdate.riderId,
      recipientTownshipId: parsed.data.recipientTownshipId,
      parcelType: parsed.data.parcelType,
      codAmount: parsed.data.codAmount,
      deliveryFee: parsed.data.deliveryFee,
      deliveryFeeStatus: actorScopedUpdate.deliveryFeeStatus,
      codStatus: actorScopedUpdate.codStatus,
    });

    if (!submissionGuard.ok) {
      return { ok: false, message: submissionGuard.message, fields: submittedFields };
    }

    const totalAmountToCollect = computeTotalAmountToCollect({
      parcelType: parsed.data.parcelType,
      codAmount: parsed.data.codAmount,
      deliveryFee: parsed.data.deliveryFee,
      deliveryFeePayer: parsed.data.deliveryFeePayer,
    });

    const parcelPatch = buildParcelPatch({
      current: current.parcel,
      next: {
        merchantId: actorScopedUpdate.merchantId,
        riderId: actorScopedUpdate.riderId,
        recipientName: parsed.data.recipientName,
        recipientPhone: parsed.data.recipientPhone,
        recipientTownshipId: parsed.data.recipientTownshipId,
        recipientAddress: parsed.data.recipientAddress,
        parcelType: parsed.data.parcelType,
        codAmount: parsed.data.parcelType === "cod" ? parsed.data.codAmount : 0,
        deliveryFee: parsed.data.deliveryFee,
        totalAmountToCollect,
        deliveryFeePayer: parsed.data.deliveryFeePayer,
        parcelStatus: actorScopedUpdate.parcelStatus,
      },
    });
    const paymentPatch = buildPaymentPatch({
      current: current.payment,
      next: {
        deliveryFeeStatus: actorScopedUpdate.deliveryFeeStatus,
        codStatus: actorScopedUpdate.codStatus,
        collectedAmount: actorScopedUpdate.collectedAmount,
        collectionStatus: actorScopedUpdate.collectionStatus,
        merchantSettlementStatus: actorScopedUpdate.merchantSettlementStatus,
        riderPayoutStatus: actorScopedUpdate.riderPayoutStatus,
        paymentNote: actorScopedUpdate.paymentNote,
      },
    });

    if (
      Object.keys(parcelPatch.patch).length === 0 &&
      Object.keys(paymentPatch.patch).length === 0
    ) {
      return { ok: true, message: "No changes detected.", fields: submittedFields };
    }

    await updateParcelAndPaymentWithAudit({
      actorAppUserId: currentUser.appUserId,
      parcelId: parsed.data.parcelId,
      parcelPatch: parcelPatch.patch,
      paymentPatch: paymentPatch.patch,
      parcelOldValues: parcelPatch.oldValues,
      paymentOldValues: paymentPatch.oldValues,
      parcelEvent:
        current.parcel.status !== "cancelled" && actorScopedUpdate.parcelStatus === "cancelled"
          ? "parcel.cancelled"
          : "parcel.update",
    });

    revalidateParcelPaths({
      parcelId: parsed.data.parcelId,
      merchantIds: [current.parcel.merchantId, actorScopedUpdate.merchantId],
      riderIds: [current.parcel.riderId, actorScopedUpdate.riderId],
    });

    return {
      ok: true,
      message: "Parcel updated successfully.",
      fields: submittedFields,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update parcel.";

    return { ok: false, message, fields: submittedFields };
  }
}

export async function advanceRiderParcelAction(formData: FormData): Promise<void> {
  const parsed = advanceRiderParcelSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return;
  }

  const { parcelId, nextStatus } = parsed.data;

  try {
    const currentUser = await requireAppAccessContext();
    const current = await getParcelUpdateContextForViewer(currentUser, parcelId);

    if (!current) {
      return;
    }

    const riderParcelActionAccess = getRiderParcelActionAccess({
      viewer: currentUser,
      parcel: {
        riderId: current.parcel.riderId,
      },
    });

    if (!riderParcelActionAccess.canProgressStatus) {
      return;
    }

    const nextAction = getNextAssignedRiderAction({
      viewer: currentUser,
      parcel: {
        riderId: current.parcel.riderId,
        status: current.parcel.status,
      },
    });

    if (nextAction?.nextStatus !== nextStatus.trim()) {
      return;
    }

    await updateParcelAndPaymentWithAudit({
      actorAppUserId: currentUser.appUserId,
      parcelId,
      parcelPatch: {
        status: nextAction.nextStatus,
      },
      paymentPatch: {},
      parcelOldValues: {
        status: current.parcel.status,
      },
      paymentOldValues: null,
      parcelEvent: "parcel.rider_progressed",
    });

    revalidateParcelPaths({
      parcelId,
      merchantIds: [current.parcel.merchantId],
      riderIds: [current.parcel.riderId],
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to update parcel status.");
  }
}
