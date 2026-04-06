"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import {
  buildParcelPatch,
  buildPaymentPatch,
  createParcelWithPaymentAndAudit,
  getParcelUpdateContext,
  isParcelCodeInUse,
  updateParcelAndPaymentWithAudit,
} from "./dal";
import {
  createParcelSchema,
  DEFAULT_CREATE_PARCEL_STATE,
  generateParcelCode,
  isAdminDashboardRole,
  updateParcelSchema,
  validateCreateDeliveryFeeState,
  validateUpdateCodState,
} from "./utils";
import { requirePermission } from "@/features/auth/server/utils";
import { findMerchantByAppUserId } from "@/features/merchant/server/dal";
import { computeTotalAmountToCollect, toMoneyString } from "@/features/parcels/server/utils";
import { getRiderById } from "@/features/rider/server/dal";
import { findTownshipById } from "@/features/townships/server/dal";

import type {
  CreateParcelActionResult,
  CreateParcelFormFields,
  UpdateParcelFormFields,
  UpdateParcelActionResult,
} from "./dto";

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
  const merchant = await findMerchantByAppUserId(input.merchantId);

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

function revalidateParcelPaths(parcelId: string) {
  revalidatePath("/dashboard/parcels");
  revalidatePath(`/dashboard/parcels/${parcelId}`);
}

export async function createParcelAction(
  _prevState: CreateParcelActionResult,
  formData: FormData,
): Promise<CreateParcelActionResult> {
  const submittedFields = extractCreateParcelFields(formData);

  try {
    const currentUser = await requirePermission("parcel.create");

    if (!isAdminDashboardRole(currentUser.role.slug)) {
      return {
        ok: false,
        message: "Only super admin and office admin can create parcels.",
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

    const refs = await validateParcelReferences({
      merchantId: parsed.data.merchantId,
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
        merchantId: parsed.data.merchantId,
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

    revalidateParcelPaths(created.parcelId);

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
    const currentUser = await requirePermission("parcel.update");

    const parsed = updateParcelSchema.safeParse(submittedFields);

    if (!parsed.success) {
      return {
        ok: false,
        message: "Please provide valid parcel and payment update details.",
        fields: submittedFields,
      };
    }

    const refs = await validateParcelReferences({
      merchantId: parsed.data.merchantId,
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
      codStatus: parsed.data.codStatus,
    });

    if (!codStateGuard.ok) {
      return { ok: false, message: codStateGuard.message, fields: submittedFields };
    }

    const current = await getParcelUpdateContext(parsed.data.parcelId, currentUser);

    if (!current) {
      return { ok: false, message: "Parcel was not found.", fields: submittedFields };
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
        merchantId: parsed.data.merchantId,
        riderId: parsed.data.riderId,
        recipientName: parsed.data.recipientName,
        recipientPhone: parsed.data.recipientPhone,
        recipientTownshipId: parsed.data.recipientTownshipId,
        recipientAddress: parsed.data.recipientAddress,
        parcelType: parsed.data.parcelType,
        codAmount: parsed.data.parcelType === "cod" ? parsed.data.codAmount : 0,
        deliveryFee: parsed.data.deliveryFee,
        totalAmountToCollect,
        deliveryFeePayer: parsed.data.deliveryFeePayer,
        parcelStatus: parsed.data.parcelStatus,
      },
    });
    const paymentPatch = buildPaymentPatch({
      current: current.payment,
      next: {
        deliveryFeeStatus: parsed.data.deliveryFeeStatus,
        codStatus: parsed.data.codStatus,
        collectedAmount: parsed.data.collectedAmount,
        collectionStatus: parsed.data.collectionStatus,
        merchantSettlementStatus: parsed.data.merchantSettlementStatus,
        riderPayoutStatus: parsed.data.riderPayoutStatus,
        paymentNote: parsed.data.paymentNote,
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
        current.parcel.status !== "cancelled" && parsed.data.parcelStatus === "cancelled"
          ? "parcel.cancelled"
          : "parcel.update",
    });

    revalidateParcelPaths(parsed.data.parcelId);

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
