"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import {
    addressBookDeleteSchema,
    addressBookPickupLocationSchema,
    addressBookRecipientContactSchema,
} from "@/features/address-book/server/utils";
import { requirePermission } from "@/features/auth/server/utils";
import {
    bulkDeleteMerchantContacts,
    createMerchantContact,
    deleteMerchantContact,
    findMerchantContactById,
    findMerchantContactByLabel,
    updateMerchantContact,
} from "@/features/merchant-contacts/server/dal";
import {
    createMerchantPickupLocation,
    deleteMerchantPickupLocation,
    findMerchantPickupLocationById,
    findMerchantPickupLocationByLabel,
    setMerchantPickupLocationDefault,
    updateMerchantPickupLocation,
} from "@/features/merchant-pickup-locations/server/dal";
import { findMerchantProfileLinkByAppUserId } from "@/features/merchant/server/dal";
import { findTownshipById } from "@/features/townships/server/dal";
import { logAuditEvent } from "@/lib/security/audit";

import type { AddressBookActionResult } from "@/features/address-book/server/dto";

async function resolveAddressBookMerchantId(
    currentUser: Awaited<ReturnType<typeof requirePermission>>,
    rawMerchantId: string,
) {
    if (currentUser.roleSlug === "merchant") {
        return currentUser.appUserId;
    }

    const merchant = await findMerchantProfileLinkByAppUserId(rawMerchantId);

    return merchant ? merchant.appUserId : null;
}

async function validateTownshipReference(townshipId: string, fieldName: string) {
    const township = await findTownshipById(townshipId);

    if (!township?.isActive) {
        return {
            ok: false as const,
            message: "Selected township was not found.",
            fieldErrors: {
                [fieldName]: ["Selected township was not found."],
            },
        };
    }

    return { ok: true as const };
}

function revalidateAddressBookPaths() {
    revalidatePath("/dashboard/address-book");
    revalidatePath("/dashboard/parcels/create");
}

export async function createRecipientContactAction(
    _prevState: AddressBookActionResult,
    formData: FormData,
): Promise<AddressBookActionResult> {
    try {
        const currentUser = await requirePermission("address-book.create");
        const parsed = addressBookRecipientContactSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            return { ok: false, message: "Please provide valid contact details." };
        }

        const merchantId = await resolveAddressBookMerchantId(currentUser, parsed.data.merchantId);

        if (!merchantId) {
            return { ok: false, message: "Selected merchant was not found." };
        }

        const townshipGuard = await validateTownshipReference(
            parsed.data.recipientTownshipId,
            "recipientTownshipId",
        );

        if (!townshipGuard.ok) {
            return townshipGuard;
        }

        const conflict = await findMerchantContactByLabel({
            merchantId,
            contactLabel: parsed.data.contactLabel,
        });

        if (conflict) {
            return {
                ok: false,
                message: "A contact with this label already exists for the merchant.",
                fieldErrors: {
                    contactLabel: ["A contact with this label already exists for the merchant."],
                },
            };
        }

        await createMerchantContact({
            merchantId,
            contactLabel: parsed.data.contactLabel,
            recipientName: parsed.data.recipientName,
            recipientPhone: parsed.data.recipientPhone,
            recipientTownshipId: parsed.data.recipientTownshipId,
            recipientAddress: parsed.data.recipientAddress,
        });

        await logAuditEvent({
            event: "address-book.recipient-contact.create",
            actorAppUserId: currentUser.appUserId,
            metadata: { merchantId, contactLabel: parsed.data.contactLabel },
        });

        revalidateAddressBookPaths();

        return { ok: true, message: "Recipient contact created." };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Unable to create recipient contact.",
        };
    }
}

export async function updateRecipientContactAction(
    _prevState: AddressBookActionResult,
    formData: FormData,
): Promise<AddressBookActionResult> {
    try {
        const currentUser = await requirePermission("address-book.update");
        const parsed = addressBookRecipientContactSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success || !parsed.data.contactId) {
            return { ok: false, message: "Please provide valid contact details." };
        }

        const merchantId = await resolveAddressBookMerchantId(currentUser, parsed.data.merchantId);

        if (!merchantId) {
            return { ok: false, message: "Selected merchant was not found." };
        }

        const existingContact = await findMerchantContactById({
            merchantId,
            contactId: parsed.data.contactId,
        });

        if (!existingContact) {
            return { ok: false, message: "Recipient contact was not found." };
        }

        const townshipGuard = await validateTownshipReference(
            parsed.data.recipientTownshipId,
            "recipientTownshipId",
        );

        if (!townshipGuard.ok) {
            return townshipGuard;
        }

        const conflict = await findMerchantContactByLabel({
            merchantId,
            contactLabel: parsed.data.contactLabel,
            excludeContactId: parsed.data.contactId,
        });

        if (conflict) {
            return {
                ok: false,
                message: "A contact with this label already exists for the merchant.",
                fieldErrors: {
                    contactLabel: ["A contact with this label already exists for the merchant."],
                },
            };
        }

        await updateMerchantContact({
            merchantId,
            contactId: parsed.data.contactId,
            contactLabel: parsed.data.contactLabel,
            recipientName: parsed.data.recipientName,
            recipientPhone: parsed.data.recipientPhone,
            recipientTownshipId: parsed.data.recipientTownshipId,
            recipientAddress: parsed.data.recipientAddress,
        });

        await logAuditEvent({
            event: "address-book.recipient-contact.update",
            actorAppUserId: currentUser.appUserId,
            metadata: { merchantId, contactId: parsed.data.contactId },
        });

        revalidateAddressBookPaths();

        return { ok: true, message: "Recipient contact updated." };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Unable to update recipient contact.",
        };
    }
}

export async function deleteRecipientContactAction(formData: FormData) {
    const currentUser = await requirePermission("address-book.delete");
    const parsed = addressBookDeleteSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success || !parsed.data.contactId) {
        throw new Error("Recipient contact was not found.");
    }

    const merchantId = await resolveAddressBookMerchantId(currentUser, parsed.data.merchantId);

    if (!merchantId) {
        throw new Error("Selected merchant was not found.");
    }

    await deleteMerchantContact({
        merchantId,
        contactId: parsed.data.contactId,
    });

    await logAuditEvent({
        event: "address-book.recipient-contact.delete",
        actorAppUserId: currentUser.appUserId,
        metadata: { merchantId, contactId: parsed.data.contactId },
    });

    revalidateAddressBookPaths();
}

export async function bulkDeleteRecipientContactsAction(formData: FormData) {
    const currentUser = await requirePermission("address-book.delete");
    const merchantIdRaw = String(formData.get("merchantId") ?? "");
    const merchantId = await resolveAddressBookMerchantId(currentUser, merchantIdRaw);

    if (!merchantId) {
        throw new Error("Selected merchant was not found.");
    }

    const contactIds = formData
        .getAll("contactIds")
        .map((value) => String(value).trim())
        .filter(Boolean);

    await bulkDeleteMerchantContacts({ merchantId, contactIds });

    await logAuditEvent({
        event: "address-book.recipient-contact.bulk-delete",
        actorAppUserId: currentUser.appUserId,
        metadata: {
            merchantId,
            deletedCount: contactIds.length,
        },
    });

    revalidateAddressBookPaths();
}

export async function createPickupLocationAction(
    _prevState: AddressBookActionResult,
    formData: FormData,
): Promise<AddressBookActionResult> {
    try {
        const currentUser = await requirePermission("address-book.create");
        const parsed = addressBookPickupLocationSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success) {
            return { ok: false, message: "Please provide valid pickup location details." };
        }

        const merchantId = await resolveAddressBookMerchantId(currentUser, parsed.data.merchantId);

        if (!merchantId) {
            return { ok: false, message: "Selected merchant was not found." };
        }

        const townshipGuard = await validateTownshipReference(parsed.data.townshipId, "townshipId");

        if (!townshipGuard.ok) {
            return townshipGuard;
        }

        const conflict = await findMerchantPickupLocationByLabel({
            merchantId,
            label: parsed.data.label,
        });

        if (conflict) {
            return {
                ok: false,
                message: "A pickup location with this label already exists for the merchant.",
                fieldErrors: {
                    label: ["A pickup location with this label already exists for the merchant."],
                },
            };
        }

        await createMerchantPickupLocation({
            merchantId,
            label: parsed.data.label,
            townshipId: parsed.data.townshipId,
            pickupAddress: parsed.data.pickupAddress,
            isDefault: parsed.data.isDefault,
        });

        await logAuditEvent({
            event: "address-book.pickup-location.create",
            actorAppUserId: currentUser.appUserId,
            metadata: { merchantId, label: parsed.data.label, isDefault: parsed.data.isDefault },
        });

        revalidateAddressBookPaths();

        return { ok: true, message: "Pickup location created." };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Unable to create pickup location.",
        };
    }
}

export async function updatePickupLocationAction(
    _prevState: AddressBookActionResult,
    formData: FormData,
): Promise<AddressBookActionResult> {
    try {
        const currentUser = await requirePermission("address-book.update");
        const parsed = addressBookPickupLocationSchema.safeParse(Object.fromEntries(formData));

        if (!parsed.success || !parsed.data.pickupLocationId) {
            return { ok: false, message: "Please provide valid pickup location details." };
        }

        const merchantId = await resolveAddressBookMerchantId(currentUser, parsed.data.merchantId);

        if (!merchantId) {
            return { ok: false, message: "Selected merchant was not found." };
        }

        const existingPickupLocation = await findMerchantPickupLocationById({
            merchantId,
            pickupLocationId: parsed.data.pickupLocationId,
        });

        if (!existingPickupLocation) {
            return { ok: false, message: "Pickup location was not found." };
        }

        const townshipGuard = await validateTownshipReference(parsed.data.townshipId, "townshipId");

        if (!townshipGuard.ok) {
            return townshipGuard;
        }

        const conflict = await findMerchantPickupLocationByLabel({
            merchantId,
            label: parsed.data.label,
            excludePickupLocationId: parsed.data.pickupLocationId,
        });

        if (conflict) {
            return {
                ok: false,
                message: "A pickup location with this label already exists for the merchant.",
                fieldErrors: {
                    label: ["A pickup location with this label already exists for the merchant."],
                },
            };
        }

        await updateMerchantPickupLocation({
            merchantId,
            pickupLocationId: parsed.data.pickupLocationId,
            label: parsed.data.label,
            townshipId: parsed.data.townshipId,
            pickupAddress: parsed.data.pickupAddress,
            isDefault: parsed.data.isDefault,
        });

        await logAuditEvent({
            event: "address-book.pickup-location.update",
            actorAppUserId: currentUser.appUserId,
            metadata: { merchantId, pickupLocationId: parsed.data.pickupLocationId },
        });

        revalidateAddressBookPaths();

        return { ok: true, message: "Pickup location updated." };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Unable to update pickup location.",
        };
    }
}

export async function deletePickupLocationAction(formData: FormData) {
    const currentUser = await requirePermission("address-book.delete");
    const parsed = addressBookDeleteSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success || !parsed.data.pickupLocationId) {
        throw new Error("Pickup location was not found.");
    }

    const merchantId = await resolveAddressBookMerchantId(currentUser, parsed.data.merchantId);

    if (!merchantId) {
        throw new Error("Selected merchant was not found.");
    }

    await deleteMerchantPickupLocation({
        merchantId,
        pickupLocationId: parsed.data.pickupLocationId,
    });

    await logAuditEvent({
        event: "address-book.pickup-location.delete",
        actorAppUserId: currentUser.appUserId,
        metadata: { merchantId, pickupLocationId: parsed.data.pickupLocationId },
    });

    revalidateAddressBookPaths();
}

export async function setDefaultPickupLocationAction(formData: FormData) {
    const currentUser = await requirePermission("address-book.update");
    const parsed = addressBookDeleteSchema.safeParse(Object.fromEntries(formData));

    if (!parsed.success || !parsed.data.pickupLocationId) {
        throw new Error("Pickup location was not found.");
    }

    const merchantId = await resolveAddressBookMerchantId(currentUser, parsed.data.merchantId);

    if (!merchantId) {
        throw new Error("Selected merchant was not found.");
    }

    await setMerchantPickupLocationDefault({
        merchantId,
        pickupLocationId: parsed.data.pickupLocationId,
    });

    await logAuditEvent({
        event: "address-book.pickup-location.set-default",
        actorAppUserId: currentUser.appUserId,
        metadata: { merchantId, pickupLocationId: parsed.data.pickupLocationId },
    });

    revalidateAddressBookPaths();
}
