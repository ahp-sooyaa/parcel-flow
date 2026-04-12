import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { toAppAccessContext, type AppAccessContext } from "./dto";
import { db } from "@/db";
import { appUsers, permissions, rolePermissions, roles } from "@/db/schema";
import { getUserManagementAccess } from "@/features/auth/server/policies/user-management";

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
      permissions: sql<AppAccessContext["permissions"]>`
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

  return toAppAccessContext(row);
}

export async function getAuthenticatedUser(
  supabaseUserId: string,
): Promise<AppAccessContext | null> {
  return getAppAccessContext(eq(appUsers.supabaseUserId, supabaseUserId));
}

async function findUserByAppUserId(appUserId: string): Promise<AppAccessContext | null> {
  return getAppAccessContext(eq(appUsers.id, appUserId));
}

export async function getUserByAppUserIdForViewer(
  viewer: Pick<AppAccessContext, "appUserId" | "roleSlug" | "permissions">,
  appUserId: string,
): Promise<AppAccessContext | null> {
  const userManagementAccess = getUserManagementAccess(viewer);

  if (!userManagementAccess.canViewTarget) {
    return null;
  }

  return findUserByAppUserId(appUserId);
}

export async function findRoleBySlug(slug: RoleSlug) {
  const [role] = await db.select().from(roles).where(eq(roles.slug, slug)).limit(1);

  if (!role) {
    return null;
  }

  return role;
}
