"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import {
  buildParcelPatch,
  buildPaymentPatch,
  createParcelWithPaymentAndAudit,
  getParcelUpdateContext,
  getRiderParcelById,
  isParcelCodeInUse,
  updateParcelAndPaymentWithAudit,
} from "./dal";
import {
  canAdvanceRiderParcel,
  canCreateParcel,
  canEditParcel,
  createParcelSchema,
  DEFAULT_CREATE_PARCEL_STATE,
  generateParcelCode,
  getNextRiderParcelAction,
  type ParcelUpdateInput,
  resolveMerchantScopedParcelOwner,
  updateParcelSchema,
  validateCreateDeliveryFeeState,
  validateUpdateCodState,
} from "./utils";
import { requireAppAccessContext, requirePermission } from "@/features/auth/server/utils";
import { findMerchantProfileLinkByAppUserId } from "@/features/merchant/server/dal";
import { computeTotalAmountToCollect, toMoneyString } from "@/features/parcels/server/utils";
import { getRiderById } from "@/features/rider/server/dal";
import { findTownshipById } from "@/features/townships/server/dal";

import type {
  CreateParcelActionResult,
  CreateParcelFormFields,
  UpdateParcelFormFields,
  UpdateParcelActionResult,
} from "./dto";
import type { AppAccessContext } from "@/features/auth/server/dto";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function extractCreateParcelFields(formData: FormData): CreateParcelFormFields {
  return {
    merchantId: readFormString(formData, "merchantId"),
    riderId: readFormString(formData, "riderId"),
    recipientName: readFormString(formData, "recipientName"),
    recipientPhone: readFormString(formData, "recipientPhone"),
    recipientTownshipId: readFormString(formData, "recipientTownshipId"),
    recipientAddress: readFormString(formData, "recipientAddress"),
    parcelType: readFormString(formData, "parcelType"),
    codAmount: readFormString(formData, "codAmount"),
    deliveryFee: readFormString(formData, "deliveryFee"),
    deliveryFeePayer: readFormString(formData, "deliveryFeePayer"),
    deliveryFeeStatus: readFormString(formData, "deliveryFeeStatus"),
    paymentNote: readFormString(formData, "paymentNote"),
  };
}

function extractUpdateParcelFields(formData: FormData): UpdateParcelFormFields {
  return {
    parcelId: readFormString(formData, "parcelId"),
    merchantId: readFormString(formData, "merchantId"),
    riderId: readFormString(formData, "riderId"),
    recipientName: readFormString(formData, "recipientName"),
    recipientPhone: readFormString(formData, "recipientPhone"),
    recipientTownshipId: readFormString(formData, "recipientTownshipId"),
    recipientAddress: readFormString(formData, "recipientAddress"),
    parcelType: readFormString(formData, "parcelType"),
    codAmount: readFormString(formData, "codAmount"),
    deliveryFee: readFormString(formData, "deliveryFee"),
    deliveryFeePayer: readFormString(formData, "deliveryFeePayer"),
    parcelStatus: readFormString(formData, "parcelStatus"),
    deliveryFeeStatus: readFormString(formData, "deliveryFeeStatus"),
    codStatus: readFormString(formData, "codStatus"),
    collectedAmount: readFormString(formData, "collectedAmount"),
    collectionStatus: readFormString(formData, "collectionStatus"),
    merchantSettlementStatus: readFormString(formData, "merchantSettlementStatus"),
    riderPayoutStatus: readFormString(formData, "riderPayoutStatus"),
    paymentNote: readFormString(formData, "paymentNote"),
  };
}

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

async function validateParcelReferences(input: {
  merchantId: string;
  riderId: string | null;
  recipientTownshipId: string;
}) {
  const merchant = await findMerchantProfileLinkByAppUserId(input.merchantId);

  if (!merchant) {
    return { ok: false as const, message: "Selected merchant was not found." };
  }

  if (input.riderId) {
    const rider = await getRiderById(input.riderId);

    if (!rider?.isActive) {
      return { ok: false as const, message: "Selected rider was not found." };
    }
  }

  const township = await findTownshipById(input.recipientTownshipId);

  if (!township?.isActive) {
    return { ok: false as const, message: "Selected recipient township was not found." };
  }

  return { ok: true as const };
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

function resolveUpdateSubmissionForActor(input: {
  viewer: AppAccessContext;
  submitted: ParcelUpdateInput;
  current: Awaited<ReturnType<typeof getParcelUpdateContext>>;
  merchantId: string;
}) {
  if (input.viewer.role.slug !== "merchant") {
    return {
      merchantId: input.merchantId,
      riderId: input.submitted.riderId,
      parcelStatus: input.submitted.parcelStatus,
      deliveryFeeStatus: input.submitted.deliveryFeeStatus,
      codStatus: input.submitted.codStatus,
      collectedAmount: input.submitted.collectedAmount,
      collectionStatus: input.submitted.collectionStatus,
      merchantSettlementStatus: input.submitted.merchantSettlementStatus,
      riderPayoutStatus: input.submitted.riderPayoutStatus,
      paymentNote: input.submitted.paymentNote,
    };
  }

  if (!input.current) {
    throw new Error("Parcel was not found.");
  }

  return {
    merchantId: input.merchantId,
    riderId: input.current.parcel.riderId,
    parcelStatus: input.current.parcel.status,
    deliveryFeeStatus: input.current.payment.deliveryFeeStatus,
    codStatus: input.current.payment.codStatus,
    collectedAmount: Number(input.current.payment.collectedAmount),
    collectionStatus: input.current.payment.collectionStatus,
    merchantSettlementStatus: input.current.payment.merchantSettlementStatus,
    riderPayoutStatus: input.current.payment.riderPayoutStatus,
    paymentNote: input.current.payment.note,
  };
}

export async function createParcelAction(
  _prevState: CreateParcelActionResult,
  formData: FormData,
): Promise<CreateParcelActionResult> {
  const submittedFields = extractCreateParcelFields(formData);

  try {
    const currentUser = await requirePermission("parcel.create");

    if (!canCreateParcel(currentUser)) {
      return {
        ok: false,
        message: "You are not allowed to create parcels.",
        fields: submittedFields,
      };
    }

    const parsed = createParcelSchema.safeParse(submittedFields);

    if (!parsed.success) {
      return {
        ok: false,
        message: "Please provide valid parcel and payment details.",
        fields: submittedFields,
      };
    }

    const merchantScope = resolveMerchantScopedParcelOwner({
      viewer: currentUser,
      submittedMerchantId: parsed.data.merchantId,
    });

    if (!merchantScope.ok) {
      return { ok: false, message: merchantScope.message, fields: submittedFields };
    }

    const refs = await validateParcelReferences({
      merchantId: merchantScope.merchantId,
      riderId: parsed.data.riderId,
      recipientTownshipId: parsed.data.recipientTownshipId,
    });

    if (!refs.ok) {
      return { ok: false, message: refs.message, fields: submittedFields };
    }

    const deliveryFeeStateGuard = validateCreateDeliveryFeeState({
      parcelType: parsed.data.parcelType,
      codAmount: parsed.data.codAmount,
      deliveryFee: parsed.data.deliveryFee,
      deliveryFeeStatus: parsed.data.deliveryFeeStatus,
    });

    if (!deliveryFeeStateGuard.ok) {
      return { ok: false, message: deliveryFeeStateGuard.message, fields: submittedFields };
    }

    const codStateGuard = validateUpdateCodState({
      parcelType: parsed.data.parcelType,
      codStatus: DEFAULT_CREATE_PARCEL_STATE.codStatus,
    });

    if (!codStateGuard.ok) {
      return { ok: false, message: codStateGuard.message, fields: submittedFields };
    }

    const parcelCode = await generateUniqueParcelCode();

    const totalAmountToCollect = computeTotalAmountToCollect({
      parcelType: parsed.data.parcelType,
      codAmount: parsed.data.codAmount,
      deliveryFee: parsed.data.deliveryFee,
      deliveryFeePayer: DEFAULT_CREATE_PARCEL_STATE.deliveryFeePayer,
    });

    const created = await createParcelWithPaymentAndAudit({
      actorAppUserId: currentUser.appUserId,
      parcelValues: {
        parcelCode,
        merchantId: merchantScope.merchantId,
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
        deliveryFeeStatus: parsed.data.deliveryFeeStatus,
        codStatus: DEFAULT_CREATE_PARCEL_STATE.codStatus,
        collectedAmount: "0.00",
        collectionStatus: DEFAULT_CREATE_PARCEL_STATE.collectionStatus,
        merchantSettlementStatus: DEFAULT_CREATE_PARCEL_STATE.merchantSettlementStatus,
        riderPayoutStatus: DEFAULT_CREATE_PARCEL_STATE.riderPayoutStatus,
        note: parsed.data.paymentNote,
      },
    });

    revalidateParcelPaths({
      parcelId: created.parcelId,
      merchantIds: [merchantScope.merchantId],
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
  const submittedFields = extractUpdateParcelFields(formData);

  try {
    const currentUser = await requireAppAccessContext();

    if (!canEditParcel(currentUser)) {
      return {
        ok: false,
        message: "You are not allowed to update parcels.",
        fields: submittedFields,
      };
    }

    const parsed = updateParcelSchema.safeParse(submittedFields);

    if (!parsed.success) {
      return {
        ok: false,
        message: "Please provide valid parcel and payment update details.",
        fields: submittedFields,
      };
    }

    const current = await getParcelUpdateContext(parsed.data.parcelId, currentUser);

    if (!current) {
      return { ok: false, message: "Parcel was not found.", fields: submittedFields };
    }

    const merchantScope = resolveMerchantScopedParcelOwner({
      viewer: currentUser,
      submittedMerchantId: parsed.data.merchantId,
    });

    if (!merchantScope.ok) {
      return { ok: false, message: merchantScope.message, fields: submittedFields };
    }

    const actorScopedUpdate = resolveUpdateSubmissionForActor({
      viewer: currentUser,
      submitted: parsed.data,
      current,
      merchantId: merchantScope.merchantId,
    });

    const refs = await validateParcelReferences({
      merchantId: actorScopedUpdate.merchantId,
      riderId: actorScopedUpdate.riderId,
      recipientTownshipId: parsed.data.recipientTownshipId,
    });

    if (!refs.ok) {
      return { ok: false, message: refs.message, fields: submittedFields };
    }

    const deliveryFeeStateGuard = validateCreateDeliveryFeeState({
      parcelType: parsed.data.parcelType,
      codAmount: parsed.data.codAmount,
      deliveryFee: parsed.data.deliveryFee,
      deliveryFeeStatus: actorScopedUpdate.deliveryFeeStatus,
    });

    if (!deliveryFeeStateGuard.ok) {
      return { ok: false, message: deliveryFeeStateGuard.message, fields: submittedFields };
    }

    const codStateGuard = validateUpdateCodState({
      parcelType: parsed.data.parcelType,
      codStatus: actorScopedUpdate.codStatus,
    });

    if (!codStateGuard.ok) {
      return { ok: false, message: codStateGuard.message, fields: submittedFields };
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

export async function advanceRiderParcelAction(parcelId: string, nextStatus: string) {
  try {
    const currentUser = await requireAppAccessContext();

    if (currentUser.role.slug !== "rider") {
      return {
        ok: false,
        message: "Only rider users can perform rider parcel actions.",
      };
    }

    const current = await getParcelUpdateContext(parcelId, currentUser);

    if (!current) {
      return {
        ok: false,
        message: "Parcel was not found.",
      };
    }

    const riderParcel = await getRiderParcelById(parcelId, currentUser);

    if (!riderParcel) {
      return {
        ok: false,
        message: "Parcel was not found.",
      };
    }

    const nextAction = getNextRiderParcelAction(current.parcel.status);

    if (nextAction?.nextStatus !== nextStatus.trim()) {
      return {
        ok: false,
        message: "Parcel status cannot be advanced with this rider action.",
      };
    }

    const allowed = canAdvanceRiderParcel({
      viewer: currentUser,
      assignedRiderId: current.parcel.riderId,
      currentStatus: current.parcel.status,
      requestedNextStatus: nextAction.nextStatus,
    });

    if (!allowed.ok) {
      return {
        ok: false,
        message: allowed.message,
      };
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
      parcelId: riderParcel.id,
      merchantIds: [current.parcel.merchantId],
      riderIds: [current.parcel.riderId],
    });

    return {
      ok: true,
      message: `${nextAction.label} completed.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unable to update parcel status.",
    };
  }
}
