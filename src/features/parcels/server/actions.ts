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
    buildParcelPaymentWriteValues,
    buildParcelWriteValues,
    DEFAULT_CREATE_PARCEL_STATE,
    generateParcelCode,
    getDefaultCreateCodStatus,
    mergeParcelImageKeys,
    parseCreateParcelFormData,
    parseRiderParcelImageUploadFormData,
    parseUpdateParcelFormData,
    uploadParcelMediaFiles,
    validateParcelImageAppendLimits,
    validateParcelSubmission,
} from "./utils";
import {
    authorizeParcelCreate,
    authorizeParcelUpdate,
    getNextAssignedRiderAction,
    getRiderParcelActionAccess,
} from "@/features/auth/server/policies/parcels";
import { requireAppAccessContext, requirePermission } from "@/features/auth/server/utils";
import { computeTotalAmountToCollect } from "@/features/parcels/server/utils";

import type {
    CreateParcelActionResult,
    ParcelUpdateContextDto,
    RiderParcelImageUploadActionResult,
    UpdateParcelActionResult,
} from "./dto";

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

function rejectMerchantPaymentSlipUpload(
    roleSlug: string,
    paymentSlipImageCount: number,
    fields: Record<string, string>,
) {
    if (roleSlug === "merchant" && paymentSlipImageCount > 0) {
        return {
            ok: false as const,
            message: "Merchant users cannot upload payment slip images.",
            fields,
            fieldErrors: {
                paymentSlipImages: ["Merchant users cannot upload payment slip images."],
            },
        };
    }

    return null;
}

function rejectRiderPaymentSlipUpload(
    paymentSlipImageCount: number,
    fields: Record<string, string>,
) {
    if (paymentSlipImageCount > 0) {
        return {
            ok: false as const,
            message: "Rider users cannot upload payment slip images.",
            fields,
            fieldErrors: {
                paymentSlipImages: ["Rider users cannot upload payment slip images."],
            },
        };
    }

    return null;
}

function rejectSettlementManagedParcelUpdate(input: {
    current: ParcelUpdateContextDto;
    next: {
        merchantId: string;
        parcelStatus: ParcelUpdateContextDto["parcel"]["status"];
        deliveryFeeStatus: ParcelUpdateContextDto["payment"]["deliveryFeeStatus"];
        codStatus: ParcelUpdateContextDto["payment"]["codStatus"];
        merchantSettlementStatus: ParcelUpdateContextDto["payment"]["merchantSettlementStatus"];
    };
    submitted: {
        parcelType: ParcelUpdateContextDto["parcel"]["parcelType"];
        codAmount: number;
        deliveryFee: number;
        deliveryFeePayer: ParcelUpdateContextDto["parcel"]["deliveryFeePayer"];
    };
}) {
    if (input.next.merchantSettlementStatus !== input.current.payment.merchantSettlementStatus) {
        return {
            ok: false as const,
            message: "Merchant settlement status is managed by the settlement workflow.",
        };
    }

    if (!input.current.payment.merchantSettlementId) {
        return { ok: true as const };
    }

    const settlementStatus = input.current.payment.merchantSettlementStatus;
    const isLocked = settlementStatus === "in_progress" || settlementStatus === "settled";

    if (!isLocked) {
        return { ok: true as const };
    }

    const changesSettlementTotal =
        input.next.merchantId !== input.current.parcel.merchantId ||
        input.next.parcelStatus !== input.current.parcel.status ||
        input.submitted.parcelType !== input.current.parcel.parcelType ||
        input.submitted.codAmount !== Number(input.current.parcel.codAmount) ||
        input.submitted.deliveryFee !== Number(input.current.parcel.deliveryFee) ||
        input.submitted.deliveryFeePayer !== input.current.parcel.deliveryFeePayer ||
        input.next.deliveryFeeStatus !== input.current.payment.deliveryFeeStatus ||
        input.next.codStatus !== input.current.payment.codStatus;

    if (changesSettlementTotal) {
        return {
            ok: false as const,
            message: "Parcel financial fields are locked by merchant settlement.",
        };
    }

    return { ok: true as const };
}

export async function createParcelAction(
    _prevState: CreateParcelActionResult,
    formData: FormData,
): Promise<CreateParcelActionResult> {
    let submittedFields: Record<string, string> = {};

    try {
        const currentUser = await requirePermission("parcel.create");
        const parsed = parseCreateParcelFormData(formData);

        submittedFields = parsed.fields;

        if (!parsed.ok) {
            return {
                ok: false,
                message: parsed.message,
                fields: submittedFields,
                fieldErrors: parsed.fieldErrors,
            };
        }

        const merchantUploadGuard = rejectMerchantPaymentSlipUpload(
            currentUser.roleSlug,
            parsed.files.paymentSlipImages.length,
            submittedFields,
        );

        if (merchantUploadGuard) {
            return merchantUploadGuard;
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

        const appendLimitGuard = validateParcelImageAppendLimits({
            currentPickupImageCount: 0,
            currentProofOfDeliveryImageCount: 0,
            currentPaymentSlipImageCount: 0,
            files: parsed.files,
        });

        if (!appendLimitGuard.ok) {
            return {
                ok: false,
                message: appendLimitGuard.message,
                fields: submittedFields,
                fieldErrors: appendLimitGuard.fieldErrors,
            };
        }

        const parcelCode = await generateUniqueParcelCode();

        const totalAmountToCollect = computeTotalAmountToCollect({
            parcelType: parsed.data.parcelType,
            codAmount: parsed.data.codAmount,
            deliveryFee: parsed.data.deliveryFee,
            deliveryFeePayer: parsed.data.deliveryFeePayer,
        });
        const uploadedMedia = await uploadParcelMediaFiles({
            parcelCode,
            files: parsed.files,
        });

        const created = await createParcelWithPaymentAndAudit({
            actorAppUserId: currentUser.appUserId,
            parcelValues: {
                parcelCode,
                ...buildParcelWriteValues({
                    data: parsed.data,
                    merchantId: createAuthorization.merchantId,
                    riderId: parsed.data.riderId,
                    totalAmountToCollect,
                    parcelStatus: DEFAULT_CREATE_PARCEL_STATE.parcelStatus,
                    pickupImageKeys: uploadedMedia.pickupImageKeys,
                    proofOfDeliveryImageKeys: uploadedMedia.proofOfDeliveryImageKeys,
                }),
            },
            paymentValues: buildParcelPaymentWriteValues({
                deliveryFeeStatus: DEFAULT_CREATE_PARCEL_STATE.deliveryFeeStatus,
                codStatus: createCodStatus,
                collectedAmount: 0,
                collectionStatus: DEFAULT_CREATE_PARCEL_STATE.collectionStatus,
                merchantSettlementStatus: DEFAULT_CREATE_PARCEL_STATE.merchantSettlementStatus,
                riderPayoutStatus: DEFAULT_CREATE_PARCEL_STATE.riderPayoutStatus,
                paymentNote: parsed.data.paymentNote,
                paymentSlipImageKeys: uploadedMedia.paymentSlipImageKeys,
            }),
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
    let submittedFields: Record<string, string> = {};

    try {
        const currentUser = await requireAppAccessContext();
        const parsed = parseUpdateParcelFormData(formData);

        submittedFields = parsed.fields;

        if (!parsed.ok) {
            return {
                ok: false,
                message: parsed.message,
                fields: submittedFields,
                fieldErrors: parsed.fieldErrors,
            };
        }

        const merchantUploadGuard = rejectMerchantPaymentSlipUpload(
            currentUser.roleSlug,
            parsed.files.paymentSlipImages.length,
            submittedFields,
        );

        if (merchantUploadGuard) {
            return merchantUploadGuard;
        }

        const current = await getParcelUpdateContextForViewer(currentUser, parsed.data.parcelId);

        if (!current) {
            return { ok: false, message: "Parcel was not found.", fields: submittedFields };
        }

        const appendLimitGuard = validateParcelImageAppendLimits({
            currentPickupImageCount: current.parcel.pickupImageKeys.length,
            currentProofOfDeliveryImageCount: current.parcel.proofOfDeliveryImageKeys.length,
            currentPaymentSlipImageCount: current.payment.paymentSlipImageKeys.length,
            files: parsed.files,
        });

        if (!appendLimitGuard.ok) {
            return {
                ok: false,
                message: appendLimitGuard.message,
                fields: submittedFields,
                fieldErrors: appendLimitGuard.fieldErrors,
            };
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
        const settlementGuard = rejectSettlementManagedParcelUpdate({
            current,
            next: {
                merchantId: actorScopedUpdate.merchantId,
                parcelStatus: actorScopedUpdate.parcelStatus,
                deliveryFeeStatus: actorScopedUpdate.deliveryFeeStatus,
                codStatus: actorScopedUpdate.codStatus,
                merchantSettlementStatus: actorScopedUpdate.merchantSettlementStatus,
            },
            submitted: {
                parcelType: parsed.data.parcelType,
                codAmount: parsed.data.codAmount,
                deliveryFee: parsed.data.deliveryFee,
                deliveryFeePayer: parsed.data.deliveryFeePayer,
            },
        });

        if (!settlementGuard.ok) {
            return { ok: false, message: settlementGuard.message, fields: submittedFields };
        }

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
        const uploadedMedia = await uploadParcelMediaFiles({
            parcelCode: current.parcel.parcelCode,
            files: parsed.files,
        });

        const parcelPatch = buildParcelPatch({
            current: current.parcel,
            next: buildParcelWriteValues({
                data: parsed.data,
                merchantId: actorScopedUpdate.merchantId,
                riderId: actorScopedUpdate.riderId,
                totalAmountToCollect,
                parcelStatus: actorScopedUpdate.parcelStatus,
                pickupImageKeys: mergeParcelImageKeys(
                    current.parcel.pickupImageKeys,
                    uploadedMedia.pickupImageKeys,
                ),
                proofOfDeliveryImageKeys: mergeParcelImageKeys(
                    current.parcel.proofOfDeliveryImageKeys,
                    uploadedMedia.proofOfDeliveryImageKeys,
                ),
            }),
        });
        const paymentPatch = buildPaymentPatch({
            current: current.payment,
            next: buildParcelPaymentWriteValues({
                deliveryFeeStatus: actorScopedUpdate.deliveryFeeStatus,
                codStatus: actorScopedUpdate.codStatus,
                collectedAmount: actorScopedUpdate.collectedAmount,
                collectionStatus: actorScopedUpdate.collectionStatus,
                merchantSettlementStatus: actorScopedUpdate.merchantSettlementStatus,
                riderPayoutStatus: actorScopedUpdate.riderPayoutStatus,
                paymentNote: actorScopedUpdate.paymentNote,
                paymentSlipImageKeys: mergeParcelImageKeys(
                    current.payment.paymentSlipImageKeys,
                    uploadedMedia.paymentSlipImageKeys,
                ),
            }),
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
                current.parcel.status !== "cancelled" &&
                actorScopedUpdate.parcelStatus === "cancelled"
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

export async function uploadRiderParcelImagesAction(
    _prevState: RiderParcelImageUploadActionResult,
    formData: FormData,
): Promise<RiderParcelImageUploadActionResult> {
    let submittedFields: Record<string, string> = {};

    try {
        const currentUser = await requireAppAccessContext();
        const parsed = parseRiderParcelImageUploadFormData(formData);

        submittedFields = parsed.fields;

        if (!parsed.ok) {
            return {
                ok: false,
                message: parsed.message,
                fields: submittedFields,
                fieldErrors: parsed.fieldErrors,
            };
        }

        const riderUploadGuard = rejectRiderPaymentSlipUpload(
            parsed.files.paymentSlipImages.length,
            submittedFields,
        );

        if (riderUploadGuard) {
            return riderUploadGuard;
        }

        const current = await getParcelUpdateContextForViewer(currentUser, parsed.data.parcelId);

        if (!current) {
            return { ok: false, message: "Parcel was not found.", fields: submittedFields };
        }

        const riderParcelActionAccess = getRiderParcelActionAccess({
            viewer: currentUser,
            parcel: {
                riderId: current.parcel.riderId,
            },
        });

        if (!riderParcelActionAccess.canUploadProofOfDelivery) {
            return { ok: false, message: "You are not allowed to upload parcel images." };
        }

        const appendLimitGuard = validateParcelImageAppendLimits({
            currentPickupImageCount: current.parcel.pickupImageKeys.length,
            currentProofOfDeliveryImageCount: current.parcel.proofOfDeliveryImageKeys.length,
            currentPaymentSlipImageCount: current.payment.paymentSlipImageKeys.length,
            files: parsed.files,
        });

        if (!appendLimitGuard.ok) {
            return {
                ok: false,
                message: appendLimitGuard.message,
                fields: submittedFields,
                fieldErrors: appendLimitGuard.fieldErrors,
            };
        }

        if (
            parsed.files.pickupImages.length === 0 &&
            parsed.files.proofOfDeliveryImages.length === 0
        ) {
            return {
                ok: false,
                message: "Please select at least one pickup or proof of delivery image.",
                fields: submittedFields,
                fieldErrors: {
                    pickupImages: ["Select at least one image to upload."],
                    proofOfDeliveryImages: ["Select at least one image to upload."],
                },
            };
        }

        const uploadedMedia = await uploadParcelMediaFiles({
            parcelCode: current.parcel.parcelCode,
            files: parsed.files,
        });

        const { id: _id, parcelCode: _parcelCode, ...currentParcelValues } = current.parcel;
        const parcelPatch = buildParcelPatch({
            current: current.parcel,
            next: {
                ...currentParcelValues,
                pickupImageKeys: mergeParcelImageKeys(
                    current.parcel.pickupImageKeys,
                    uploadedMedia.pickupImageKeys,
                ),
                proofOfDeliveryImageKeys: mergeParcelImageKeys(
                    current.parcel.proofOfDeliveryImageKeys,
                    uploadedMedia.proofOfDeliveryImageKeys,
                ),
            },
        });

        if (Object.keys(parcelPatch.patch).length === 0) {
            return { ok: true, message: "No changes detected.", fields: submittedFields };
        }

        await updateParcelAndPaymentWithAudit({
            actorAppUserId: currentUser.appUserId,
            parcelId: parsed.data.parcelId,
            parcelPatch: parcelPatch.patch,
            paymentPatch: {},
            parcelOldValues: parcelPatch.oldValues,
            paymentOldValues: null,
            parcelEvent: "parcel.rider_images_uploaded",
        });

        revalidateParcelPaths({
            parcelId: parsed.data.parcelId,
            merchantIds: [current.parcel.merchantId],
            riderIds: [current.parcel.riderId],
        });

        return {
            ok: true,
            message: "Parcel images uploaded successfully.",
            fields: submittedFields,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to upload parcel images.";

        return { ok: false, message, fields: submittedFields };
    }
}
