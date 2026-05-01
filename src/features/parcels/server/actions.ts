"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import {
    buildParcelPatch,
    buildPaymentPatch,
    createParcelsWithPaymentsAndAudit,
    getParcelUpdateContextForViewer,
    isParcelCodeInUse,
    updateParcelAndPaymentWithAudit,
} from "./dal";
import {
    adminCorrectParcelStateSchema,
    advanceOfficeParcelStatusSchema,
    advanceRiderParcelSchema,
    buildParcelPaymentWriteValues,
    buildParcelWriteValues,
    canReceiveParcelCashAtOffice,
    DEFAULT_CREATE_PARCEL_STATE,
    generateParcelCode,
    getDefaultCreateCollectionStatus,
    getDeliveryFeeResolutionOptions,
    getDefaultCreateCodStatus,
    getOfficeParcelMovementActions,
    mergeParcelImageKeys,
    parcelIdActionSchema,
    parseCreateParcelFormData,
    parseRiderParcelImageUploadFormData,
    parseUpdateParcelDetailFormData,
    resolveParcelDeliveryFeeSchema,
    uploadParcelMediaFiles,
    validateCreateParcelMedia,
    validateCreateParcelBatchSubmission,
    validateDeliveryFeeStatusForParcel,
    validateImmutablePackageCount,
    validateParcelImageAppendLimits,
    validateParcelPaymentState,
    validateParcelStatusProofImages,
    validatePaymentSlipImagesForPlan,
    validateParcelSubmission,
} from "./utils";
import {
    authorizeParcelCreate,
    getNextAssignedRiderAction,
    getParcelAccess,
    getRiderParcelActionAccess,
} from "@/features/auth/server/policies/parcels";
import { requireAppAccessContext, requirePermission } from "@/features/auth/server/utils";
import {
    findMerchantContactById,
    upsertMerchantContact,
} from "@/features/merchant-contacts/server/dal";
import {
    findMerchantPickupLocationById,
    findMerchantPickupLocationByLabel,
    saveMerchantPickupLocationDraft,
} from "@/features/merchant-pickup-locations/server/dal";
import { getSettlementManagedParcelFinancialState } from "@/features/merchant-settlements/server/merchant-financial-item-dal";
import { computeTotalAmountToCollect } from "@/features/parcels/server/utils";

import type {
    CreateParcelActionResult,
    ParcelOperationActionResult,
    ParcelUpdateContextDto,
    RiderParcelImageUploadActionResult,
    UpdateParcelActionResult,
} from "./dto";

async function generateUniqueParcelCode(input?: {
    maxAttempts?: number;
    reservedCodes?: Set<string>;
}) {
    const maxAttempts = input?.maxAttempts ?? 10;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const code = generateParcelCode();

        if (input?.reservedCodes?.has(code)) {
            continue;
        }

        const alreadyUsed = await isParcelCodeInUse(code);

        // Another row in the same batch can reserve this code while we're awaiting the DB check.
        if (!alreadyUsed && !input?.reservedCodes?.has(code)) {
            input?.reservedCodes?.add(code);
            return code;
        }
    }

    throw new Error("Could not generate unique parcel code.");
}

async function validateRecipientContactReference(input: {
    merchantId: string;
    selectedMerchantContactId: string | null;
    saveRecipientContact: boolean;
    contactLabel: string | null;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
}) {
    if (input.selectedMerchantContactId) {
        const selectedContact = await findMerchantContactById({
            merchantId: input.merchantId,
            contactId: input.selectedMerchantContactId,
        });

        if (!selectedContact) {
            return {
                ok: false as const,
                message: "Selected contact was not found for this merchant.",
                fieldErrors: {
                    selectedMerchantContactId: [
                        "Selected contact was not found for this merchant.",
                    ],
                },
            };
        }
    }

    if (!input.saveRecipientContact) {
        return { ok: true as const };
    }

    if (!input.contactLabel) {
        return {
            ok: false as const,
            message: "Contact label is required when saving to the address book.",
            fieldErrors: {
                contactLabel: ["Contact label is required when saving to the address book."],
            },
        };
    }

    return { ok: true as const };
}

function buildRecipientContactUpsertInput(input: {
    merchantId: string;
    contactLabel: string;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
}) {
    return {
        merchantId: input.merchantId,
        contactLabel: input.contactLabel,
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        recipientTownshipId: input.recipientTownshipId,
        recipientAddress: input.recipientAddress,
    };
}

async function validateCreatePickupLocationReference(input: {
    merchantId: string;
    pickupLocationId: string | null;
    pickupLocationLabel: string;
    pickupTownshipId: string;
    pickupAddress: string;
    pickupContactName: string;
    pickupContactPhone: string;
    savePickupLocation: boolean;
}) {
    if (input.pickupLocationId) {
        const selectedPickupLocation = await findMerchantPickupLocationById({
            merchantId: input.merchantId,
            pickupLocationId: input.pickupLocationId,
        });

        if (!selectedPickupLocation) {
            return {
                ok: false as const,
                message: "Selected pickup location was not found for this merchant.",
                fieldErrors: {
                    pickupLocationId: ["Selected pickup location was not found for this merchant."],
                },
            };
        }

        if (!input.savePickupLocation) {
            return { ok: true as const };
        }

        const conflict = await findMerchantPickupLocationByLabel({
            merchantId: input.merchantId,
            label: input.pickupLocationLabel,
            excludePickupLocationId: input.pickupLocationId,
        });

        if (conflict) {
            return {
                ok: false as const,
                message: "A pickup location with this label already exists for the merchant.",
                fieldErrors: {
                    pickupLocationLabel: [
                        "A pickup location with this label already exists for the merchant.",
                    ],
                },
            };
        }

        return { ok: true as const };
    }

    if (!input.savePickupLocation) {
        return { ok: true as const };
    }

    const conflict = await findMerchantPickupLocationByLabel({
        merchantId: input.merchantId,
        label: input.pickupLocationLabel,
    });

    if (conflict) {
        return {
            ok: false as const,
            message: "A pickup location with this label already exists for the merchant.",
            fieldErrors: {
                pickupLocationLabel: [
                    "A pickup location with this label already exists for the merchant.",
                ],
            },
        };
    }

    return { ok: true as const };
}

function revalidateParcelPaths(input: {
    parcelId?: string;
    parcelIds?: string[];
    merchantIds?: Array<string | null | undefined>;
    riderIds?: Array<string | null | undefined>;
}) {
    revalidatePath("/dashboard/parcels");

    const parcelIds = new Set(
        [input.parcelId, ...(input.parcelIds ?? [])].filter((parcelId): parcelId is string =>
            Boolean(parcelId),
        ),
    );

    for (const parcelId of parcelIds) {
        revalidatePath(`/dashboard/parcels/${parcelId}`);
        revalidatePath(`/dashboard/parcels/${parcelId}/edit`);
    }

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
        collectedAmount: number;
        collectionStatus: ParcelUpdateContextDto["payment"]["collectionStatus"];
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
        input.next.codStatus !== input.current.payment.codStatus ||
        input.next.collectedAmount !== Number(input.current.payment.collectedAmount) ||
        input.next.collectionStatus !== input.current.payment.collectionStatus;

    if (changesSettlementTotal) {
        return {
            ok: false as const,
            message: "Parcel financial fields are locked by merchant settlement.",
        };
    }

    return { ok: true as const };
}

function rejectSettlementLockedParcelDetailUpdate(input: {
    current: ParcelUpdateContextDto;
    next: {
        merchantId: string;
        parcelType: ParcelUpdateContextDto["parcel"]["parcelType"];
        codAmount: number;
        deliveryFee: number;
        deliveryFeePayer: ParcelUpdateContextDto["parcel"]["deliveryFeePayer"];
        deliveryFeePaymentPlan: ParcelUpdateContextDto["parcel"]["deliveryFeePaymentPlan"];
    };
}) {
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
        input.next.parcelType !== input.current.parcel.parcelType ||
        input.next.codAmount !== Number(input.current.parcel.codAmount) ||
        input.next.deliveryFee !== Number(input.current.parcel.deliveryFee) ||
        input.next.deliveryFeePayer !== input.current.parcel.deliveryFeePayer ||
        input.next.deliveryFeePaymentPlan !== input.current.parcel.deliveryFeePaymentPlan;

    if (changesSettlementTotal) {
        return {
            ok: false as const,
            message: "Parcel financial fields are locked by merchant settlement.",
        };
    }

    return { ok: true as const };
}

function getSubmittedStringFields(formData: FormData) {
    return Object.fromEntries(
        Array.from(formData.entries())
            .filter((entry): entry is [string, string] => typeof entry[1] === "string")
            .map(([key, value]) => [key, value]),
    );
}

function getParcelOperationInput(current: ParcelUpdateContextDto) {
    return {
        parcelType: current.parcel.parcelType,
        parcelStatus: current.parcel.status,
        codAmount: current.parcel.codAmount,
        deliveryFee: current.parcel.deliveryFee,
        totalAmountToCollect: current.parcel.totalAmountToCollect,
        deliveryFeePayer: current.parcel.deliveryFeePayer,
        deliveryFeePaymentPlan: current.parcel.deliveryFeePaymentPlan,
        deliveryFeeStatus: current.payment.deliveryFeeStatus,
        codStatus: current.payment.codStatus,
        collectedAmount: current.payment.collectedAmount,
        collectionStatus: current.payment.collectionStatus,
        merchantSettlementStatus: current.payment.merchantSettlementStatus,
        merchantSettlementId: current.payment.merchantSettlementId,
        paymentNote: current.payment.note,
    };
}

async function hasManagedMerchantFinancialItems(parcelId: string) {
    const financialState = await getSettlementManagedParcelFinancialState(parcelId);

    return financialState.hasLockedItems || financialState.hasClosedItems;
}

export async function createParcelAction(
    _prevState: CreateParcelActionResult,
    formData: FormData,
): Promise<CreateParcelActionResult> {
    let submittedFields: Record<string, string> = {};
    let successRedirectPath: string | null = null;

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

        const createMediaGuard = validateCreateParcelMedia({
            deliveryFeePaymentPlan: parsed.data.deliveryFeePaymentPlan,
            files: parsed.files,
        });

        if (!createMediaGuard.ok) {
            return {
                ok: false,
                message: createMediaGuard.message,
                fields: submittedFields,
                fieldErrors: createMediaGuard.fieldErrors,
            };
        }

        const createAuthorization = authorizeParcelCreate({
            viewer: currentUser,
            submittedMerchantId: parsed.data.merchantId,
        });

        if (!createAuthorization.ok) {
            return { ok: false, message: createAuthorization.message, fields: submittedFields };
        }

        const submissionGuard = await validateCreateParcelBatchSubmission({
            merchantId: createAuthorization.merchantId,
            riderId: parsed.data.riderId,
            pickupTownshipId: parsed.data.pickupTownshipId,
            recipientTownshipId: parsed.data.recipientTownshipId,
            deliveryFeePayer: parsed.data.deliveryFeePayer,
            deliveryFeePaymentPlan: parsed.data.deliveryFeePaymentPlan,
            parcelRows: parsed.data.parcelRows,
        });

        if (!submissionGuard.ok) {
            return {
                ok: false,
                message: submissionGuard.message,
                fields: submittedFields,
                fieldErrors:
                    "fieldErrors" in submissionGuard
                        ? (submissionGuard.fieldErrors as CreateParcelActionResult["fieldErrors"])
                        : undefined,
            };
        }

        const recipientContactGuard = await validateRecipientContactReference({
            merchantId: createAuthorization.merchantId,
            selectedMerchantContactId: parsed.data.selectedMerchantContactId,
            saveRecipientContact: parsed.data.saveRecipientContact,
            contactLabel: parsed.data.contactLabel,
            recipientName: parsed.data.recipientName,
            recipientPhone: parsed.data.recipientPhone,
            recipientTownshipId: parsed.data.recipientTownshipId,
            recipientAddress: parsed.data.recipientAddress,
        });

        if (!recipientContactGuard.ok) {
            return {
                ok: false,
                message: recipientContactGuard.message,
                fields: submittedFields,
                fieldErrors: recipientContactGuard.fieldErrors,
            };
        }

        const pickupLocationGuard = await validateCreatePickupLocationReference({
            merchantId: createAuthorization.merchantId,
            pickupLocationId: parsed.data.pickupLocationId,
            pickupLocationLabel: parsed.data.pickupLocationLabel,
            pickupTownshipId: parsed.data.pickupTownshipId,
            pickupAddress: parsed.data.pickupAddress,
            pickupContactName: parsed.data.pickupContactName,
            pickupContactPhone: parsed.data.pickupContactPhone,
            savePickupLocation: parsed.data.savePickupLocation,
        });

        if (!pickupLocationGuard.ok) {
            return {
                ok: false,
                message: pickupLocationGuard.message,
                fields: submittedFields,
                fieldErrors: pickupLocationGuard.fieldErrors,
            };
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

        const batchUploadScope = `batch-${randomUUID()}`;
        const uploadedMedia = await uploadParcelMediaFiles({
            scope: batchUploadScope,
            files: parsed.files,
        });
        const created = await createParcelsWithPaymentsAndAudit({
            actorAppUserId: currentUser.appUserId,
            buildItems: async (tx) => {
                if (parsed.data.saveRecipientContact) {
                    await upsertMerchantContact({
                        ...buildRecipientContactUpsertInput({
                            merchantId: createAuthorization.merchantId,
                            contactLabel: parsed.data.contactLabel ?? "",
                            recipientName: parsed.data.recipientName,
                            recipientPhone: parsed.data.recipientPhone,
                            recipientTownshipId: parsed.data.recipientTownshipId,
                            recipientAddress: parsed.data.recipientAddress,
                        }),
                        dbClient: tx,
                    });
                }

                const pickupDetails = await saveMerchantPickupLocationDraft({
                    merchantId: createAuthorization.merchantId,
                    pickupLocationId: parsed.data.pickupLocationId,
                    label: parsed.data.pickupLocationLabel,
                    townshipId: parsed.data.pickupTownshipId,
                    pickupAddress: parsed.data.pickupAddress,
                    contactName: parsed.data.pickupContactName,
                    contactPhone: parsed.data.pickupContactPhone,
                    savePickupLocation: parsed.data.savePickupLocation,
                    dbClient: tx,
                });

                if (!pickupDetails) {
                    throw new Error("Selected pickup location was not found for this merchant.");
                }

                const reservedParcelCodes = new Set<string>();
                const { parcelRows, ...sharedFields } = parsed.data;

                return Promise.all(
                    parcelRows.flatMap((row) =>
                        Array.from({ length: row.packageCount }, async () => {
                            const parcelCode = await generateUniqueParcelCode({
                                reservedCodes: reservedParcelCodes,
                            });
                            const parcelData = { ...sharedFields, ...row, packageCount: 1 };
                            const createCodStatus = getDefaultCreateCodStatus(row.parcelType);
                            const createCollectionStatus = getDefaultCreateCollectionStatus(
                                row.parcelType,
                            );
                            const totalAmountToCollect = computeTotalAmountToCollect({
                                parcelType: row.parcelType,
                                codAmount: row.codAmount,
                                deliveryFee: row.deliveryFee,
                                deliveryFeePayer: sharedFields.deliveryFeePayer,
                            });

                            return {
                                parcelValues: {
                                    parcelCode,
                                    ...buildParcelWriteValues({
                                        data: parcelData,
                                        merchantId: createAuthorization.merchantId,
                                        riderId: sharedFields.riderId,
                                        pickupDetails,
                                        totalAmountToCollect,
                                        deliveryFeePaymentPlan: sharedFields.deliveryFeePaymentPlan,
                                        parcelStatus: DEFAULT_CREATE_PARCEL_STATE.parcelStatus,
                                        pickupImageKeys: uploadedMedia.pickupImageKeys,
                                        proofOfDeliveryImageKeys:
                                            uploadedMedia.proofOfDeliveryImageKeys,
                                    }),
                                },
                                paymentValues: buildParcelPaymentWriteValues({
                                    deliveryFeeStatus:
                                        DEFAULT_CREATE_PARCEL_STATE.deliveryFeeStatus,
                                    codStatus: createCodStatus,
                                    collectedAmount: 0,
                                    collectionStatus: createCollectionStatus,
                                    merchantSettlementStatus:
                                        DEFAULT_CREATE_PARCEL_STATE.merchantSettlementStatus,
                                    riderPayoutStatus:
                                        DEFAULT_CREATE_PARCEL_STATE.riderPayoutStatus,
                                    paymentNote: sharedFields.paymentNote,
                                    paymentSlipImageKeys: uploadedMedia.paymentSlipImageKeys,
                                }),
                            };
                        }),
                    ),
                );
            },
        });

        revalidateParcelPaths({
            parcelIds: created.map((item) => item.parcelId),
            merchantIds: [createAuthorization.merchantId],
            riderIds: [parsed.data.riderId],
        });
        successRedirectPath = `/dashboard/parcels?created=${created.length}`;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to create parcel.";

        return { ok: false, message, fields: submittedFields };
    }

    if (successRedirectPath) {
        redirect(successRedirectPath);
    }

    return {
        ok: false,
        message: "Unable to create parcel.",
        fields: submittedFields,
    };
}

export async function updateParcelAction(
    _prevState: UpdateParcelActionResult,
    formData: FormData,
): Promise<UpdateParcelActionResult> {
    let submittedFields: Record<string, string> = {};

    try {
        const currentUser = await requireAppAccessContext();
        const parsed = parseUpdateParcelDetailFormData(formData);

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

        const paymentSlipPlanGuard = validatePaymentSlipImagesForPlan({
            deliveryFeePaymentPlan: parsed.data.deliveryFeePaymentPlan,
            paymentSlipImages: parsed.files.paymentSlipImages,
            existingPaymentSlipImageCount: current.payment.paymentSlipImageKeys.length,
        });

        if (!paymentSlipPlanGuard.ok) {
            return {
                ok: false,
                message: paymentSlipPlanGuard.message,
                fields: submittedFields,
                fieldErrors: paymentSlipPlanGuard.fieldErrors,
            };
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

        const parcelAccess = getParcelAccess({
            viewer: currentUser,
            parcel: {
                merchantId: current.parcel.merchantId,
                riderId: current.parcel.riderId,
            },
        });

        if (!parcelAccess.canUpdate) {
            return {
                ok: false,
                message: "You are not allowed to update parcels.",
                fields: submittedFields,
            };
        }

        if (
            currentUser.roleSlug === "merchant" &&
            parsed.data.merchantId !== current.parcel.merchantId
        ) {
            return {
                ok: false,
                message: "Merchant users can only manage parcels for their own merchant profile.",
                fields: submittedFields,
            };
        }

        const packageCountGuard = validateImmutablePackageCount({
            currentPackageCount: current.parcel.packageCount,
            submittedPackageCount: parsed.data.packageCount,
        });

        if (!packageCountGuard.ok) {
            return {
                ok: false,
                message: packageCountGuard.message,
                fields: submittedFields,
                fieldErrors: packageCountGuard.fieldErrors,
            };
        }

        const actorScopedUpdate = {
            merchantId:
                currentUser.roleSlug === "merchant"
                    ? current.parcel.merchantId
                    : parsed.data.merchantId,
            riderId:
                currentUser.roleSlug === "merchant" ? current.parcel.riderId : parsed.data.riderId,
        };
        const settlementGuard = rejectSettlementLockedParcelDetailUpdate({
            current,
            next: {
                merchantId: actorScopedUpdate.merchantId,
                parcelType: parsed.data.parcelType,
                codAmount: parsed.data.codAmount,
                deliveryFee: parsed.data.deliveryFee,
                deliveryFeePayer: parsed.data.deliveryFeePayer,
                deliveryFeePaymentPlan: parsed.data.deliveryFeePaymentPlan,
            },
        });

        if (!settlementGuard.ok) {
            return { ok: false, message: settlementGuard.message, fields: submittedFields };
        }

        const submissionGuard = await validateParcelSubmission({
            merchantId: actorScopedUpdate.merchantId,
            riderId: actorScopedUpdate.riderId,
            pickupTownshipId: parsed.data.pickupTownshipId,
            recipientTownshipId: parsed.data.recipientTownshipId,
            parcelType: parsed.data.parcelType,
            codAmount: parsed.data.codAmount,
            deliveryFee: parsed.data.deliveryFee,
            deliveryFeePayer: parsed.data.deliveryFeePayer,
            deliveryFeePaymentPlan: parsed.data.deliveryFeePaymentPlan,
            requireRecordedDeliveryFeePaymentPlan: current.parcel.deliveryFeePaymentPlan !== null,
            deliveryFeeStatus: current.payment.deliveryFeeStatus,
            parcelStatus: current.parcel.status,
            codStatus: current.payment.codStatus,
        });

        if (!submissionGuard.ok) {
            return {
                ok: false,
                message: submissionGuard.message,
                fields: submittedFields,
                fieldErrors:
                    "fieldErrors" in submissionGuard
                        ? (submissionGuard.fieldErrors as UpdateParcelActionResult["fieldErrors"])
                        : undefined,
            };
        }

        const recipientContactGuard = await validateRecipientContactReference({
            merchantId: actorScopedUpdate.merchantId,
            selectedMerchantContactId: parsed.data.selectedMerchantContactId,
            saveRecipientContact: parsed.data.saveRecipientContact,
            contactLabel: parsed.data.contactLabel,
            recipientName: parsed.data.recipientName,
            recipientPhone: parsed.data.recipientPhone,
            recipientTownshipId: parsed.data.recipientTownshipId,
            recipientAddress: parsed.data.recipientAddress,
        });

        if (!recipientContactGuard.ok) {
            return {
                ok: false,
                message: recipientContactGuard.message,
                fields: submittedFields,
                fieldErrors: recipientContactGuard.fieldErrors,
            };
        }

        const pickupLocationGuard = await validateCreatePickupLocationReference({
            merchantId: actorScopedUpdate.merchantId,
            pickupLocationId: parsed.data.pickupLocationId,
            pickupLocationLabel: parsed.data.pickupLocationLabel,
            pickupTownshipId: parsed.data.pickupTownshipId,
            pickupAddress: parsed.data.pickupAddress,
            pickupContactName: parsed.data.pickupContactName,
            pickupContactPhone: parsed.data.pickupContactPhone,
            savePickupLocation: parsed.data.savePickupLocation,
        });

        if (!pickupLocationGuard.ok) {
            return {
                ok: false,
                message: pickupLocationGuard.message,
                fields: submittedFields,
                fieldErrors: pickupLocationGuard.fieldErrors,
            };
        }

        const pickupDetails = await saveMerchantPickupLocationDraft({
            merchantId: actorScopedUpdate.merchantId,
            pickupLocationId: parsed.data.pickupLocationId,
            label: parsed.data.pickupLocationLabel,
            townshipId: parsed.data.pickupTownshipId,
            pickupAddress: parsed.data.pickupAddress,
            contactName: parsed.data.pickupContactName,
            contactPhone: parsed.data.pickupContactPhone,
            savePickupLocation: parsed.data.savePickupLocation,
        });

        if (!pickupDetails) {
            return {
                ok: false,
                message: "Selected pickup location was not found for this merchant.",
                fields: submittedFields,
                fieldErrors: {
                    pickupLocationId: ["Selected pickup location was not found for this merchant."],
                },
            };
        }

        const paymentStateGuard = validateParcelPaymentState({
            parcelType: parsed.data.parcelType,
            parcelStatus: current.parcel.status,
            deliveryFeePayer: parsed.data.deliveryFeePayer,
            codAmount: parsed.data.codAmount,
            deliveryFee: parsed.data.deliveryFee,
            deliveryFeeStatus: current.payment.deliveryFeeStatus,
            previousDeliveryFeeStatus: current.payment.deliveryFeeStatus,
            codStatus: current.payment.codStatus,
            collectionStatus: current.payment.collectionStatus,
            merchantSettlementStatus: current.payment.merchantSettlementStatus,
            merchantSettlementId: current.payment.merchantSettlementId,
            paymentNote: current.payment.note,
        });

        if (!paymentStateGuard.ok) {
            return { ok: false, message: paymentStateGuard.message, fields: submittedFields };
        }

        const totalAmountToCollect = computeTotalAmountToCollect({
            parcelType: parsed.data.parcelType,
            codAmount: parsed.data.codAmount,
            deliveryFee: parsed.data.deliveryFee,
            deliveryFeePayer: parsed.data.deliveryFeePayer,
        });
        const uploadedMedia = await uploadParcelMediaFiles({
            scope: current.parcel.parcelCode,
            files: parsed.files,
        });

        const parcelPatch = buildParcelPatch({
            current: current.parcel,
            next: buildParcelWriteValues({
                data: parsed.data,
                merchantId: actorScopedUpdate.merchantId,
                riderId: actorScopedUpdate.riderId,
                pickupDetails,
                totalAmountToCollect,
                deliveryFeePaymentPlan: parsed.data.deliveryFeePaymentPlan,
                parcelStatus: current.parcel.status,
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
                deliveryFeeStatus: current.payment.deliveryFeeStatus,
                codStatus: current.payment.codStatus,
                collectedAmount: Number(current.payment.collectedAmount),
                collectionStatus: current.payment.collectionStatus,
                merchantSettlementStatus: current.payment.merchantSettlementStatus,
                riderPayoutStatus: current.payment.riderPayoutStatus,
                paymentNote: current.payment.note,
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
            parcelEvent: "parcel.update",
            beforeCommit: parsed.data.saveRecipientContact
                ? async (tx) => {
                      await upsertMerchantContact({
                          ...buildRecipientContactUpsertInput({
                              merchantId: actorScopedUpdate.merchantId,
                              contactLabel: parsed.data.contactLabel ?? "",
                              recipientName: parsed.data.recipientName,
                              recipientPhone: parsed.data.recipientPhone,
                              recipientTownshipId: parsed.data.recipientTownshipId,
                              recipientAddress: parsed.data.recipientAddress,
                          }),
                          dbClient: tx,
                      });
                  }
                : undefined,
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

export async function advanceOfficeParcelStatusAction(
    _prevState: ParcelOperationActionResult,
    formData: FormData,
): Promise<ParcelOperationActionResult> {
    const fields = getSubmittedStringFields(formData);
    const parsed = advanceOfficeParcelStatusSchema.safeParse(fields);

    if (!parsed.success) {
        return { ok: false, message: "Parcel id and next status are required.", fields };
    }

    try {
        const currentUser = await requirePermission("parcel.update");
        const current = await getParcelUpdateContextForViewer(currentUser, parsed.data.parcelId);

        if (!current) {
            return { ok: false, message: "Parcel was not found.", fields };
        }

        if (await hasManagedMerchantFinancialItems(parsed.data.parcelId)) {
            return {
                ok: false,
                message: "Parcel financial fields are locked by merchant settlement.",
                fields,
            };
        }

        const movementActions = getOfficeParcelMovementActions(getParcelOperationInput(current));
        const requestedAction = movementActions.find(
            (action) => action.nextStatus === parsed.data.nextStatus,
        );

        if (!requestedAction) {
            return { ok: false, message: "This parcel status change is not available.", fields };
        }

        const proofGuard = validateParcelStatusProofImages({
            nextStatus: requestedAction.nextStatus,
            pickupImageKeys: current.parcel.pickupImageKeys,
            proofOfDeliveryImageKeys: current.parcel.proofOfDeliveryImageKeys,
        });

        if (!proofGuard.ok) {
            return {
                ok: false,
                message: proofGuard.message,
                fields,
                fieldErrors: proofGuard.fieldErrors,
            };
        }

        const nextPaymentValues =
            requestedAction.nextStatus === "delivered"
                ? {
                      deliveryFeeStatus: current.payment.deliveryFeeStatus,
                      codStatus:
                          current.parcel.parcelType === "cod"
                              ? ("collected" as const)
                              : ("not_applicable" as const),
                      collectedAmount:
                          current.parcel.parcelType === "cod"
                              ? Number(current.parcel.totalAmountToCollect)
                              : Number(current.payment.collectedAmount),
                      collectionStatus:
                          current.parcel.parcelType === "cod"
                              ? ("collected_by_rider" as const)
                              : current.payment.collectionStatus,
                      merchantSettlementStatus: current.payment.merchantSettlementStatus,
                      riderPayoutStatus: current.payment.riderPayoutStatus,
                      paymentNote: current.payment.note,
                      paymentSlipImageKeys: current.payment.paymentSlipImageKeys,
                  }
                : null;
        const paymentStateGuard = validateParcelPaymentState({
            parcelType: current.parcel.parcelType,
            parcelStatus: requestedAction.nextStatus,
            deliveryFeePayer: current.parcel.deliveryFeePayer,
            codAmount: Number(current.parcel.codAmount),
            deliveryFee: Number(current.parcel.deliveryFee),
            deliveryFeeStatus:
                nextPaymentValues?.deliveryFeeStatus ?? current.payment.deliveryFeeStatus,
            previousDeliveryFeeStatus: current.payment.deliveryFeeStatus,
            codStatus: nextPaymentValues?.codStatus ?? current.payment.codStatus,
            collectionStatus:
                nextPaymentValues?.collectionStatus ?? current.payment.collectionStatus,
            merchantSettlementStatus: current.payment.merchantSettlementStatus,
            merchantSettlementId: current.payment.merchantSettlementId,
            paymentNote: current.payment.note,
        });

        if (!paymentStateGuard.ok) {
            return { ok: false, message: paymentStateGuard.message, fields };
        }

        const paymentPatch = nextPaymentValues
            ? buildPaymentPatch({
                  current: current.payment,
                  next: buildParcelPaymentWriteValues(nextPaymentValues),
              })
            : { patch: {}, oldValues: null };

        await updateParcelAndPaymentWithAudit({
            actorAppUserId: currentUser.appUserId,
            parcelId: parsed.data.parcelId,
            parcelPatch: {
                status: requestedAction.nextStatus,
            },
            paymentPatch: paymentPatch.patch,
            parcelOldValues: {
                status: current.parcel.status,
            },
            paymentOldValues: paymentPatch.oldValues,
            parcelEvent: "parcel.office_progressed",
        });

        revalidateParcelPaths({
            parcelId: parsed.data.parcelId,
            merchantIds: [current.parcel.merchantId],
            riderIds: [current.parcel.riderId],
        });

        return { ok: true, message: `${requestedAction.label} completed.`, fields };
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to update parcel operation.";

        return { ok: false, message, fields };
    }
}

export async function receiveParcelCashAtOfficeAction(
    _prevState: ParcelOperationActionResult,
    formData: FormData,
): Promise<ParcelOperationActionResult> {
    const fields = getSubmittedStringFields(formData);
    const parsed = parcelIdActionSchema.safeParse(fields);

    if (!parsed.success) {
        return { ok: false, message: "Parcel id is required.", fields };
    }

    try {
        const currentUser = await requirePermission("parcel.update");
        const current = await getParcelUpdateContextForViewer(currentUser, parsed.data.parcelId);

        if (!current) {
            return { ok: false, message: "Parcel was not found.", fields };
        }

        if (await hasManagedMerchantFinancialItems(parsed.data.parcelId)) {
            return {
                ok: false,
                message: "Parcel financial fields are locked by merchant settlement.",
                fields,
            };
        }

        if (!canReceiveParcelCashAtOffice(getParcelOperationInput(current))) {
            return { ok: false, message: "This parcel cash cannot be received at office.", fields };
        }

        const collectedAmount =
            Number(current.payment.collectedAmount) > 0
                ? Number(current.payment.collectedAmount)
                : Number(current.parcel.totalAmountToCollect);
        const nextPaymentValues = {
            deliveryFeeStatus: current.payment.deliveryFeeStatus,
            codStatus: current.payment.codStatus,
            collectedAmount,
            collectionStatus: "received_by_office" as const,
            merchantSettlementStatus: current.payment.merchantSettlementStatus,
            riderPayoutStatus: current.payment.riderPayoutStatus,
            paymentNote: current.payment.note,
            paymentSlipImageKeys: current.payment.paymentSlipImageKeys,
        };
        const paymentStateGuard = validateParcelPaymentState({
            parcelType: current.parcel.parcelType,
            parcelStatus: current.parcel.status,
            deliveryFeePayer: current.parcel.deliveryFeePayer,
            codAmount: Number(current.parcel.codAmount),
            deliveryFee: Number(current.parcel.deliveryFee),
            deliveryFeeStatus: nextPaymentValues.deliveryFeeStatus,
            previousDeliveryFeeStatus: current.payment.deliveryFeeStatus,
            codStatus: nextPaymentValues.codStatus,
            collectionStatus: nextPaymentValues.collectionStatus,
            merchantSettlementStatus: nextPaymentValues.merchantSettlementStatus,
            merchantSettlementId: current.payment.merchantSettlementId,
            paymentNote: nextPaymentValues.paymentNote,
        });

        if (!paymentStateGuard.ok) {
            return { ok: false, message: paymentStateGuard.message, fields };
        }

        const paymentPatch = buildPaymentPatch({
            current: current.payment,
            next: buildParcelPaymentWriteValues(nextPaymentValues),
        });

        if (Object.keys(paymentPatch.patch).length === 0) {
            return { ok: true, message: "No changes detected.", fields };
        }

        await updateParcelAndPaymentWithAudit({
            actorAppUserId: currentUser.appUserId,
            parcelId: parsed.data.parcelId,
            parcelPatch: {},
            paymentPatch: paymentPatch.patch,
            parcelOldValues: null,
            paymentOldValues: paymentPatch.oldValues,
            parcelEvent: "parcel.update",
            paymentEvent: "parcel.cash_received_by_office",
        });

        revalidateParcelPaths({
            parcelId: parsed.data.parcelId,
            merchantIds: [current.parcel.merchantId],
            riderIds: [current.parcel.riderId],
        });

        return { ok: true, message: "Cash received by office.", fields };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to receive parcel cash.";

        return { ok: false, message, fields };
    }
}

export async function resolveParcelDeliveryFeeAction(
    _prevState: ParcelOperationActionResult,
    formData: FormData,
): Promise<ParcelOperationActionResult> {
    const fields = getSubmittedStringFields(formData);
    const parsed = resolveParcelDeliveryFeeSchema.safeParse(fields);

    if (!parsed.success) {
        return { ok: false, message: "Parcel id and delivery fee status are required.", fields };
    }

    try {
        const currentUser = await requirePermission("parcel.update");
        const current = await getParcelUpdateContextForViewer(currentUser, parsed.data.parcelId);

        if (!current) {
            return { ok: false, message: "Parcel was not found.", fields };
        }

        if (await hasManagedMerchantFinancialItems(parsed.data.parcelId)) {
            return {
                ok: false,
                message: "Parcel financial fields are locked by merchant settlement.",
                fields,
            };
        }

        const operationInput = getParcelOperationInput(current);
        const resolutionOptions = getDeliveryFeeResolutionOptions(operationInput);

        if (!resolutionOptions.includes(parsed.data.deliveryFeeStatus)) {
            return {
                ok: false,
                message: "This delivery fee resolution is not available.",
                fields,
            };
        }

        const paymentNote = parsed.data.paymentNote ?? current.payment.note;
        const nextPaymentValues = {
            deliveryFeeStatus: parsed.data.deliveryFeeStatus,
            codStatus: current.payment.codStatus,
            collectedAmount: Number(current.payment.collectedAmount),
            collectionStatus: current.payment.collectionStatus,
            merchantSettlementStatus: current.payment.merchantSettlementStatus,
            riderPayoutStatus: current.payment.riderPayoutStatus,
            paymentNote,
            paymentSlipImageKeys: current.payment.paymentSlipImageKeys,
        };
        const paymentStateGuard = validateParcelPaymentState({
            parcelType: current.parcel.parcelType,
            parcelStatus: current.parcel.status,
            deliveryFeePayer: current.parcel.deliveryFeePayer,
            codAmount: Number(current.parcel.codAmount),
            deliveryFee: Number(current.parcel.deliveryFee),
            deliveryFeeStatus: nextPaymentValues.deliveryFeeStatus,
            previousDeliveryFeeStatus: current.payment.deliveryFeeStatus,
            codStatus: nextPaymentValues.codStatus,
            collectionStatus: nextPaymentValues.collectionStatus,
            merchantSettlementStatus: nextPaymentValues.merchantSettlementStatus,
            merchantSettlementId: current.payment.merchantSettlementId,
            paymentNote: nextPaymentValues.paymentNote,
        });

        if (!paymentStateGuard.ok) {
            return { ok: false, message: paymentStateGuard.message, fields };
        }

        const paymentPatch = buildPaymentPatch({
            current: current.payment,
            next: buildParcelPaymentWriteValues(nextPaymentValues),
        });

        if (Object.keys(paymentPatch.patch).length === 0) {
            return { ok: true, message: "No changes detected.", fields };
        }

        await updateParcelAndPaymentWithAudit({
            actorAppUserId: currentUser.appUserId,
            parcelId: parsed.data.parcelId,
            parcelPatch: {},
            paymentPatch: paymentPatch.patch,
            parcelOldValues: null,
            paymentOldValues: paymentPatch.oldValues,
            parcelEvent: "parcel.update",
            paymentEvent: "parcel.delivery_fee_resolved",
        });

        revalidateParcelPaths({
            parcelId: parsed.data.parcelId,
            merchantIds: [current.parcel.merchantId],
            riderIds: [current.parcel.riderId],
        });

        return { ok: true, message: "Delivery fee resolved.", fields };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to resolve delivery fee.";

        return { ok: false, message, fields };
    }
}

export async function adminCorrectParcelStateAction(
    _prevState: ParcelOperationActionResult,
    formData: FormData,
): Promise<ParcelOperationActionResult> {
    const fields = getSubmittedStringFields(formData);
    const parsed = adminCorrectParcelStateSchema.safeParse(fields);

    if (!parsed.success) {
        return {
            ok: false,
            message: "Correction note and valid parcel state fields are required.",
            fields,
            fieldErrors: parsed.error.flatten().fieldErrors,
        };
    }

    try {
        const currentUser = await requirePermission("parcel.update");
        const current = await getParcelUpdateContextForViewer(currentUser, parsed.data.parcelId);

        if (!current) {
            return { ok: false, message: "Parcel was not found.", fields };
        }

        if (await hasManagedMerchantFinancialItems(parsed.data.parcelId)) {
            return {
                ok: false,
                message: "Parcel financial fields are locked by merchant settlement.",
                fields,
            };
        }

        const settlementGuard = rejectSettlementManagedParcelUpdate({
            current,
            next: {
                merchantId: current.parcel.merchantId,
                parcelStatus: parsed.data.parcelStatus,
                deliveryFeeStatus: parsed.data.deliveryFeeStatus,
                codStatus: parsed.data.codStatus,
                collectedAmount: parsed.data.collectedAmount,
                collectionStatus: parsed.data.collectionStatus,
                merchantSettlementStatus: current.payment.merchantSettlementStatus,
            },
            submitted: {
                parcelType: current.parcel.parcelType,
                codAmount: Number(current.parcel.codAmount),
                deliveryFee: Number(current.parcel.deliveryFee),
                deliveryFeePayer: current.parcel.deliveryFeePayer,
            },
        });

        if (!settlementGuard.ok) {
            return { ok: false, message: settlementGuard.message, fields };
        }

        const deliveryFeePlanGuard = validateDeliveryFeeStatusForParcel({
            deliveryFeePayer: current.parcel.deliveryFeePayer,
            deliveryFeePaymentPlan: current.parcel.deliveryFeePaymentPlan,
            parcelStatus: parsed.data.parcelStatus,
            deliveryFeeStatus: parsed.data.deliveryFeeStatus,
        });

        if (!deliveryFeePlanGuard.ok) {
            return {
                ok: false,
                message: deliveryFeePlanGuard.message,
                fields,
                fieldErrors: deliveryFeePlanGuard.fieldErrors,
            };
        }

        const paymentStateGuard = validateParcelPaymentState({
            parcelType: current.parcel.parcelType,
            parcelStatus: parsed.data.parcelStatus,
            deliveryFeePayer: current.parcel.deliveryFeePayer,
            codAmount: Number(current.parcel.codAmount),
            deliveryFee: Number(current.parcel.deliveryFee),
            deliveryFeeStatus: parsed.data.deliveryFeeStatus,
            previousDeliveryFeeStatus: current.payment.deliveryFeeStatus,
            codStatus: parsed.data.codStatus,
            collectionStatus: parsed.data.collectionStatus,
            merchantSettlementStatus: current.payment.merchantSettlementStatus,
            merchantSettlementId: current.payment.merchantSettlementId,
            paymentNote: parsed.data.paymentNote,
        });

        if (!paymentStateGuard.ok) {
            return { ok: false, message: paymentStateGuard.message, fields };
        }

        const { id: _id, parcelCode: _parcelCode, ...currentParcelValues } = current.parcel;
        const parcelPatch = buildParcelPatch({
            current: current.parcel,
            next: {
                ...currentParcelValues,
                status: parsed.data.parcelStatus,
            },
        });
        const paymentPatch = buildPaymentPatch({
            current: current.payment,
            next: buildParcelPaymentWriteValues({
                deliveryFeeStatus: parsed.data.deliveryFeeStatus,
                codStatus: parsed.data.codStatus,
                collectedAmount: parsed.data.collectedAmount,
                collectionStatus: parsed.data.collectionStatus,
                merchantSettlementStatus: current.payment.merchantSettlementStatus,
                riderPayoutStatus: current.payment.riderPayoutStatus,
                paymentNote: parsed.data.paymentNote,
                paymentSlipImageKeys: current.payment.paymentSlipImageKeys,
            }),
        });

        if (
            Object.keys(parcelPatch.patch).length === 0 &&
            Object.keys(paymentPatch.patch).length === 0
        ) {
            return { ok: true, message: "No changes detected.", fields };
        }

        await updateParcelAndPaymentWithAudit({
            actorAppUserId: currentUser.appUserId,
            parcelId: parsed.data.parcelId,
            parcelPatch: parcelPatch.patch,
            paymentPatch: paymentPatch.patch,
            parcelOldValues: parcelPatch.oldValues,
            paymentOldValues: paymentPatch.oldValues,
            parcelEvent: "parcel.admin_corrected",
            paymentEvent: "parcel.admin_corrected",
            auditMetadata: {
                correctionNote: parsed.data.correctionNote,
            },
        });

        revalidateParcelPaths({
            parcelId: parsed.data.parcelId,
            merchantIds: [current.parcel.merchantId],
            riderIds: [current.parcel.riderId],
        });

        return { ok: true, message: "Parcel state corrected.", fields };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to correct parcel state.";

        return { ok: false, message, fields };
    }
}

export async function advanceRiderParcelAction(
    _prevState: ParcelOperationActionResult,
    formData: FormData,
): Promise<ParcelOperationActionResult> {
    const fields = getSubmittedStringFields(formData);
    const parsed = advanceRiderParcelSchema.safeParse(fields);

    if (!parsed.success) {
        return { ok: false, message: "Parcel id and next status are required.", fields };
    }

    const { parcelId, nextStatus } = parsed.data;

    try {
        const currentUser = await requireAppAccessContext();
        const current = await getParcelUpdateContextForViewer(currentUser, parcelId);

        if (!current) {
            return { ok: false, message: "Parcel was not found.", fields };
        }

        if (await hasManagedMerchantFinancialItems(parcelId)) {
            return {
                ok: false,
                message: "Parcel financial fields are locked by merchant settlement.",
                fields,
            };
        }

        const riderParcelActionAccess = getRiderParcelActionAccess({
            viewer: currentUser,
            parcel: {
                riderId: current.parcel.riderId,
            },
        });

        if (!riderParcelActionAccess.canProgressStatus) {
            return { ok: false, message: "You are not allowed to update this parcel.", fields };
        }

        const nextAction = getNextAssignedRiderAction({
            viewer: currentUser,
            parcel: {
                riderId: current.parcel.riderId,
                status: current.parcel.status,
            },
        });

        if (nextAction?.nextStatus !== nextStatus.trim()) {
            return { ok: false, message: "This parcel status change is not available.", fields };
        }

        const proofGuard = validateParcelStatusProofImages({
            nextStatus: nextAction.nextStatus,
            pickupImageKeys: current.parcel.pickupImageKeys,
            proofOfDeliveryImageKeys: current.parcel.proofOfDeliveryImageKeys,
        });

        if (!proofGuard.ok) {
            return {
                ok: false,
                message: proofGuard.message,
                fields,
                fieldErrors: proofGuard.fieldErrors,
            };
        }

        const nextPaymentValues =
            nextAction.nextStatus === "delivered"
                ? {
                      deliveryFeeStatus: current.payment.deliveryFeeStatus,
                      codStatus:
                          current.parcel.parcelType === "cod"
                              ? ("collected" as const)
                              : ("not_applicable" as const),
                      collectedAmount:
                          current.parcel.parcelType === "cod"
                              ? Number(current.parcel.totalAmountToCollect)
                              : Number(current.payment.collectedAmount),
                      collectionStatus:
                          current.parcel.parcelType === "cod"
                              ? ("collected_by_rider" as const)
                              : current.payment.collectionStatus,
                      merchantSettlementStatus: current.payment.merchantSettlementStatus,
                      riderPayoutStatus: current.payment.riderPayoutStatus,
                      paymentNote: current.payment.note,
                      paymentSlipImageKeys: current.payment.paymentSlipImageKeys,
                  }
                : null;
        const paymentStateGuard = validateParcelPaymentState({
            parcelType: current.parcel.parcelType,
            parcelStatus: nextAction.nextStatus,
            deliveryFeePayer: current.parcel.deliveryFeePayer,
            codAmount: Number(current.parcel.codAmount),
            deliveryFee: Number(current.parcel.deliveryFee),
            deliveryFeeStatus:
                nextPaymentValues?.deliveryFeeStatus ?? current.payment.deliveryFeeStatus,
            previousDeliveryFeeStatus: current.payment.deliveryFeeStatus,
            codStatus: nextPaymentValues?.codStatus ?? current.payment.codStatus,
            collectionStatus:
                nextPaymentValues?.collectionStatus ?? current.payment.collectionStatus,
            merchantSettlementStatus: current.payment.merchantSettlementStatus,
            merchantSettlementId: current.payment.merchantSettlementId,
            paymentNote: current.payment.note,
        });

        if (!paymentStateGuard.ok) {
            return { ok: false, message: paymentStateGuard.message, fields };
        }

        const paymentPatch = nextPaymentValues
            ? buildPaymentPatch({
                  current: current.payment,
                  next: buildParcelPaymentWriteValues(nextPaymentValues),
              })
            : { patch: {}, oldValues: null };

        await updateParcelAndPaymentWithAudit({
            actorAppUserId: currentUser.appUserId,
            parcelId,
            parcelPatch: {
                status: nextAction.nextStatus,
            },
            paymentPatch: paymentPatch.patch,
            parcelOldValues: {
                status: current.parcel.status,
            },
            paymentOldValues: paymentPatch.oldValues,
            parcelEvent: "parcel.rider_progressed",
        });

        revalidateParcelPaths({
            parcelId,
            merchantIds: [current.parcel.merchantId],
            riderIds: [current.parcel.riderId],
        });

        return { ok: true, message: `${nextAction.label} completed.`, fields };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update parcel status.";

        console.error(message);

        return { ok: false, message, fields };
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
            scope: current.parcel.parcelCode,
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
