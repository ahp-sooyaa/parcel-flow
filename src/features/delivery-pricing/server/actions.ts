"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import {
    createDeliveryPricingRate,
    deactivateDeliveryPricingRate,
    findApplicableDeliveryPricingRate,
    findConflictingActiveDeliveryPricingRate,
    findDeliveryPricingRateById,
    quoteDeliveryPricing,
    updateDeliveryPricingRate,
} from "./dal";
import {
    deactivateDeliveryPricingRateSchema,
    deliveryPricingQuoteSchema,
    deliveryPricingRateSchema,
    updateDeliveryPricingRateSchema,
} from "./utils";
import { authorizeParcelCreate } from "@/features/auth/server/policies/parcels";
import { requireAppAccessContext, requirePermission } from "@/features/auth/server/utils";
import { findMerchantProfileLinkByAppUserId } from "@/features/merchant/server/dal";
import { findTownshipById } from "@/features/townships/server/dal";
import { logAuditEvent } from "@/lib/security/audit";

import type { DeliveryPricingQuoteActionResult, DeliveryPricingRateActionResult } from "./dto";

async function validateRateReferences(input: { townshipId: string; merchantId: string | null }) {
    const township = await findTownshipById(input.townshipId);

    if (!township) {
        return {
            ok: false as const,
            message: "Selected township was not found.",
            fieldErrors: {
                townshipId: ["Selected township was not found."],
            },
        };
    }

    if (input.merchantId) {
        const merchant = await findMerchantProfileLinkByAppUserId(input.merchantId);

        if (!merchant) {
            return {
                ok: false as const,
                message: "Selected merchant was not found.",
                fieldErrors: {
                    merchantId: ["Selected merchant was not found."],
                },
            };
        }
    }

    return { ok: true as const };
}

function revalidateDeliveryPricingPaths() {
    revalidatePath("/dashboard/delivery-pricing");
    revalidatePath("/dashboard");
}

export async function createDeliveryPricingRateAction(
    _prevState: DeliveryPricingRateActionResult,
    formData: FormData,
): Promise<DeliveryPricingRateActionResult> {
    try {
        const currentUser = await requirePermission("delivery-pricing.create");
        const parsed = deliveryPricingRateSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            return { ok: false, message: "Please provide valid delivery pricing details." };
        }

        const referenceGuard = await validateRateReferences(parsed.data);

        if (!referenceGuard.ok) {
            return referenceGuard;
        }

        if (parsed.data.isActive) {
            const conflict = await findConflictingActiveDeliveryPricingRate({
                townshipId: parsed.data.townshipId,
                merchantId: parsed.data.merchantId,
            });

            if (conflict) {
                return {
                    ok: false,
                    message: "An active pricing rate already exists for this township and scope.",
                    fieldErrors: {
                        townshipId: [
                            "An active pricing rate already exists for this township and scope.",
                        ],
                    },
                };
            }
        }

        const created = await createDeliveryPricingRate(parsed.data);

        await logAuditEvent({
            event: "delivery-pricing.create",
            actorAppUserId: currentUser.appUserId,
            metadata: {
                townshipId: parsed.data.townshipId,
                merchantId: parsed.data.merchantId,
                isActive: parsed.data.isActive,
            },
        });

        revalidateDeliveryPricingPaths();

        return {
            ok: true,
            message: "Delivery pricing rate created.",
            rateId: created.id,
        };
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to create delivery pricing rate.";

        return { ok: false, message };
    }
}

export async function updateDeliveryPricingRateAction(
    _prevState: DeliveryPricingRateActionResult,
    formData: FormData,
): Promise<DeliveryPricingRateActionResult> {
    try {
        const currentUser = await requirePermission("delivery-pricing.update");
        const parsed = updateDeliveryPricingRateSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            return { ok: false, message: "Please provide valid delivery pricing details." };
        }

        const existingRate = await findDeliveryPricingRateById(parsed.data.rateId);

        if (!existingRate) {
            return { ok: false, message: "Delivery pricing rate not found." };
        }

        const referenceGuard = await validateRateReferences(parsed.data);

        if (!referenceGuard.ok) {
            return referenceGuard;
        }

        if (parsed.data.isActive) {
            const conflict = await findConflictingActiveDeliveryPricingRate({
                townshipId: parsed.data.townshipId,
                merchantId: parsed.data.merchantId,
                excludeRateId: parsed.data.rateId,
            });

            if (conflict) {
                return {
                    ok: false,
                    message: "An active pricing rate already exists for this township and scope.",
                    fieldErrors: {
                        townshipId: [
                            "An active pricing rate already exists for this township and scope.",
                        ],
                    },
                };
            }
        }

        await updateDeliveryPricingRate(parsed.data);

        await logAuditEvent({
            event: "delivery-pricing.update",
            actorAppUserId: currentUser.appUserId,
            metadata: {
                rateId: parsed.data.rateId,
                townshipId: parsed.data.townshipId,
                merchantId: parsed.data.merchantId,
                isActive: parsed.data.isActive,
            },
        });

        revalidateDeliveryPricingPaths();

        return { ok: true, message: "Delivery pricing rate updated.", rateId: parsed.data.rateId };
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to update delivery pricing rate.";

        return { ok: false, message };
    }
}

export async function deactivateDeliveryPricingRateAction(
    formData: FormData,
): Promise<DeliveryPricingRateActionResult> {
    try {
        const currentUser = await requirePermission("delivery-pricing.update");
        const parsed = deactivateDeliveryPricingRateSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            return { ok: false, message: "Delivery pricing rate not found." };
        }

        const existingRate = await findDeliveryPricingRateById(parsed.data.rateId);

        if (!existingRate) {
            return { ok: false, message: "Delivery pricing rate not found." };
        }

        await deactivateDeliveryPricingRate(parsed.data.rateId);

        await logAuditEvent({
            event: "delivery-pricing.deactivate",
            actorAppUserId: currentUser.appUserId,
            metadata: {
                rateId: parsed.data.rateId,
            },
        });

        revalidateDeliveryPricingPaths();

        return {
            ok: true,
            message: "Delivery pricing rate deactivated.",
            rateId: parsed.data.rateId,
        };
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to deactivate delivery pricing rate.";

        return { ok: false, message };
    }
}

export async function quoteDeliveryPricingAction(input: {
    merchantId: string;
    recipientTownshipId: string;
    estimatedWeightKg: string;
    isLargeItem: boolean;
    packageWidthCm: string;
    packageHeightCm: string;
    packageLengthCm: string;
}): Promise<DeliveryPricingQuoteActionResult> {
    try {
        const currentUser = await requireAppAccessContext();
        const parcelAccess = authorizeParcelCreate({
            viewer: currentUser,
            submittedMerchantId: input.merchantId,
        });

        if (!parcelAccess.ok) {
            return { ok: false, message: parcelAccess.message };
        }

        if (!currentUser.permissions.includes("parcel.create")) {
            return { ok: false, message: "Forbidden" };
        }

        const parsed = deliveryPricingQuoteSchema.safeParse(input);

        if (!parsed.success) {
            return { ok: false, message: "Enter valid township and parcel measurements first." };
        }

        const township = await findTownshipById(parsed.data.recipientTownshipId);

        if (!township?.isActive) {
            return { ok: false, message: "Selected township was not found." };
        }

        const quote = await quoteDeliveryPricing({
            ...parsed.data,
            merchantId: parcelAccess.merchantId,
        });

        if (!quote) {
            const hasGlobalFallback = await findApplicableDeliveryPricingRate({
                townshipId: parsed.data.recipientTownshipId,
                merchantId: null,
            });

            return {
                ok: false,
                message: hasGlobalFallback
                    ? "No merchant contract found. Select a merchant-specific override or use the global rate setup."
                    : "No active delivery pricing found for this township.",
            };
        }

        return { ok: true, ...quote };
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to quote delivery pricing.";

        return { ok: false, message };
    }
}
