import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { toAppAccessContext, type AppAccessContext } from "./dto";
import { db } from "@/db";
import { appUsers, permissions, rolePermissions, roles } from "@/db/schema";

import type { RoleSlug } from "@/db/constants";

async function getAppAccessContext(
  whereClause: ReturnType<typeof eq>,
): Promise<AppAccessContext | null> {
  const [row] = await db
    .select({
      appUserId: appUsers.id,
      supabaseUserId: appUsers.supabaseUserId,
      fullName: appUsers.fullName,
      email: appUsers.email,
      phoneNumber: appUsers.phoneNumber,
      isActive: appUsers.isActive,
      deletedAt: appUsers.deletedAt,
      mustResetPassword: appUsers.mustResetPassword,
      roleSlug: roles.slug,
      permissionSlugs: sql<string[]>`
        coalesce(
          array_agg(distinct ${permissions.slug}) filter (where ${permissions.slug} is not null),
          '{}'
        )
      `,
    })
    .from(appUsers)
    .innerJoin(roles, eq(appUsers.roleId, roles.id))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(whereClause, isNull(appUsers.deletedAt)))
    .groupBy(
      appUsers.id,
      appUsers.supabaseUserId,
      appUsers.fullName,
      appUsers.email,
      appUsers.phoneNumber,
      appUsers.isActive,
      appUsers.deletedAt,
      appUsers.mustResetPassword,
      roles.slug,
    );

  if (!row) {
    return null;
  }

  return toAppAccessContext({
    appUserId: row.appUserId,
    supabaseUserId: row.supabaseUserId,
    fullName: row.fullName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    roleSlug: row.roleSlug,
    isActive: row.isActive,
    deletedAt: row.deletedAt,
    mustResetPassword: row.mustResetPassword,
    permissions: row.permissionSlugs as AppAccessContext["permissions"],
  });
}

export async function getAuthenticatedUser(
  supabaseUserId: string,
): Promise<AppAccessContext | null> {
  return getAppAccessContext(eq(appUsers.supabaseUserId, supabaseUserId));
}

export async function getUserByAppUserId(appUserId: string): Promise<AppAccessContext | null> {
  return getAppAccessContext(eq(appUsers.id, appUserId));
}

export async function findRoleBySlug(slug: RoleSlug) {
  const [role] = await db.select().from(roles).where(eq(roles.slug, slug)).limit(1);

  return role ?? null;
}

export async function getAppUserRecordById(appUserId: string) {
  const [row] = await db
    .select()
    .from(appUsers)
    .where(and(eq(appUsers.id, appUserId), isNull(appUsers.deletedAt)))
    .limit(1);

  return row ?? null;
}
