import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { toAppUserListItemDto, type AppUserListItemDto, type UserWithRole } from "./dto";
import { db } from "@/db";
import { appUsers, merchants, riders, roles } from "@/db/schema";
import { getUserManagementAccess } from "@/features/auth/server/policies/user-management";
import { createMerchantProfile } from "@/features/merchant/server/dal";
import { createRiderProfile } from "@/features/rider/server/dal";

import type { CreateUserInput } from "./utils";
import type { AppAccessContext } from "@/features/auth/server/dto";

async function listUsers(): Promise<AppUserListItemDto[]> {
    const rows = await db
        .select({
            id: appUsers.id,
            fullName: appUsers.fullName,
            email: appUsers.email,
            phoneNumber: appUsers.phoneNumber,
            roleSlug: roles.slug,
            isActive: appUsers.isActive,
            mustResetPassword: appUsers.mustResetPassword,
            createdAt: appUsers.createdAt,
        })
        .from(appUsers)
        .innerJoin(roles, eq(appUsers.roleId, roles.id))
        .where(isNull(appUsers.deletedAt))
        .orderBy(desc(appUsers.createdAt));

    return rows.map((row) => toAppUserListItemDto(row));
}

export async function getUsersListForViewer(
    viewer: Pick<AppAccessContext, "appUserId" | "roleSlug" | "permissions">,
): Promise<AppUserListItemDto[]> {
    const userManagementAccess = getUserManagementAccess(viewer);

    if (!userManagementAccess.canViewList) {
        return [];
    }

    return listUsers();
}

async function findUserWithRoleById(userId: string): Promise<UserWithRole | null> {
    const [row] = await db
        .select({
            id: appUsers.id,
            email: appUsers.email,
            supabaseUserId: appUsers.supabaseUserId,
            isActive: appUsers.isActive,
            roleSlug: roles.slug,
        })
        .from(appUsers)
        .innerJoin(roles, eq(appUsers.roleId, roles.id))
        .where(and(eq(appUsers.id, userId), isNull(appUsers.deletedAt)))
        .limit(1);

    return row ?? null;
}

export async function getUserWithRoleById(userId: string): Promise<UserWithRole | null> {
    return findUserWithRoleById(userId);
}

export async function countActiveSuperAdminUsers(): Promise<number> {
    const [row] = await db
        .select({
            total: count(appUsers.id),
        })
        .from(appUsers)
        .innerJoin(roles, eq(appUsers.roleId, roles.id))
        .where(
            and(
                eq(roles.slug, "super_admin"),
                eq(appUsers.isActive, true),
                isNull(appUsers.deletedAt),
            ),
        );

    return Number(row?.total ?? 0);
}

export async function createAppUserWithProfiles(params: {
    input: CreateUserInput;
    roleId: string;
    supabaseUserId: string;
}) {
    const { input, roleId, supabaseUserId } = params;

    try {
        const createdAppUserId = await db.transaction(async (tx) => {
            const [createdUser] = await tx
                .insert(appUsers)
                .values({
                    supabaseUserId,
                    fullName: input.fullName,
                    email: input.email,
                    phoneNumber: input.phoneNumber,
                    roleId,
                    isActive: input.isActive,
                    mustResetPassword: true,
                })
                .returning({ id: appUsers.id });

            if (input.role === "merchant") {
                await createMerchantProfile({
                    appUserId: createdUser.id,
                    shopName: input.merchantShopName ?? input.fullName,
                    pickupTownshipId: input.merchantPickupTownshipId,
                    defaultPickupAddress: input.merchantDefaultPickupAddress,
                    notes: input.merchantNotes,
                    dbClient: tx,
                });
            }

            if (input.role === "rider") {
                await createRiderProfile({
                    appUserId: createdUser.id,
                    townshipId: input.riderTownshipId,
                    vehicleType: input.riderVehicleType ?? "bike",
                    licensePlate: input.riderLicensePlate,
                    isActive: input.riderIsActive,
                    notes: input.riderNotes,
                    dbClient: tx,
                });
            }

            return createdUser.id;
        });

        return { ok: true as const, createdAppUserId };
    } catch {
        return { ok: false as const, message: "Failed to store app user profile." };
    }
}

export async function updateUserMustResetPassword(userId: string, mustResetPassword: boolean) {
    await db.update(appUsers).set({ mustResetPassword }).where(eq(appUsers.id, userId));
}

export async function updateUserActiveStatus(userId: string, isActive: boolean) {
    await db.update(appUsers).set({ isActive }).where(eq(appUsers.id, userId));
}

export async function updateUserAccountProfile(input: {
    userId: string;
    fullName: string;
    phoneNumber: string | null;
}) {
    await db
        .update(appUsers)
        .set({
            fullName: input.fullName,
            phoneNumber: input.phoneNumber,
            updatedAt: new Date(),
        })
        .where(and(eq(appUsers.id, input.userId), isNull(appUsers.deletedAt)));
}

export async function softDeleteUserWithProfiles(input: {
    userId: string;
    deletedEmail: string;
    deletedAt: Date;
}) {
    await db.transaction(async (tx) => {
        await tx
            .update(appUsers)
            .set({
                email: input.deletedEmail,
                isActive: false,
                deletedAt: input.deletedAt,
                updatedAt: input.deletedAt,
            })
            .where(and(eq(appUsers.id, input.userId), isNull(appUsers.deletedAt)));

        await tx
            .update(merchants)
            .set({
                deletedAt: input.deletedAt,
                updatedAt: input.deletedAt,
            })
            .where(and(eq(merchants.appUserId, input.userId), isNull(merchants.deletedAt)));

        await tx
            .update(riders)
            .set({
                deletedAt: input.deletedAt,
                updatedAt: input.deletedAt,
            })
            .where(and(eq(riders.appUserId, input.userId), isNull(riders.deletedAt)));
    });
}
