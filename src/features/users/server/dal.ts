import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { toAppUserListItemDto, type AppUserListItemDto } from "./dto";
import { db } from "@/db";
import { appUsers, roles } from "@/db/schema";

import type { RoleSlug } from "@/db/constants";

export async function getUsersList(): Promise<AppUserListItemDto[]> {
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

export type UserStatusGuardContext = {
  id: string;
  isActive: boolean;
  roleSlug: RoleSlug;
};

export async function getUserStatusGuardContext(
  userId: string,
): Promise<UserStatusGuardContext | null> {
  const [row] = await db
    .select({
      id: appUsers.id,
      isActive: appUsers.isActive,
      roleSlug: roles.slug,
    })
    .from(appUsers)
    .innerJoin(roles, eq(appUsers.roleId, roles.id))
    .where(and(eq(appUsers.id, userId), isNull(appUsers.deletedAt)))
    .limit(1);

  return row ?? null;
}

export async function countActiveSuperAdminUsers(): Promise<number> {
  const [row] = await db
    .select({
      total: count(appUsers.id),
    })
    .from(appUsers)
    .innerJoin(roles, eq(appUsers.roleId, roles.id))
    .where(
      and(eq(roles.slug, "super_admin"), eq(appUsers.isActive, true), isNull(appUsers.deletedAt)),
    );

  return Number(row?.total ?? 0);
}
