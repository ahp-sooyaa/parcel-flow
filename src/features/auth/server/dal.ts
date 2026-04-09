import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { toAppAccessContext, type AppAccessContext } from "./dto";
import { db } from "@/db";
import { appUsers, permissions, rolePermissions, roles } from "@/db/schema";

import type { RoleSlug } from "@/db/constants";

export async function findAppAccessContextBySupabaseUserId(
  supabaseUserId: string,
): Promise<AppAccessContext | null> {
  const rows = await db
    .select({
      appUserId: appUsers.id,
      supabaseUserId: appUsers.supabaseUserId,
      fullName: appUsers.fullName,
      email: appUsers.email,
      phoneNumber: appUsers.phoneNumber,
      isActive: appUsers.isActive,
      deletedAt: appUsers.deletedAt,
      mustResetPassword: appUsers.mustResetPassword,
      roleId: roles.id,
      roleSlug: roles.slug,
      roleLabel: roles.label,
      permissionSlug: permissions.slug,
    })
    .from(appUsers)
    .innerJoin(roles, eq(appUsers.roleId, roles.id))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(appUsers.supabaseUserId, supabaseUserId), isNull(appUsers.deletedAt)));

  if (rows.length === 0) {
    return null;
  }

  const first = rows[0];
  const permissionSet = new Set<string>();

  for (const row of rows) {
    if (row.permissionSlug) {
      permissionSet.add(row.permissionSlug);
    }
  }

  return toAppAccessContext({
    appUserId: first.appUserId,
    supabaseUserId: first.supabaseUserId,
    fullName: first.fullName,
    email: first.email,
    phoneNumber: first.phoneNumber,
    isActive: first.isActive,
    deletedAt: first.deletedAt,
    mustResetPassword: first.mustResetPassword,
    role: {
      id: first.roleId,
      slug: first.roleSlug,
      label: first.roleLabel,
    },
    permissions: Array.from(permissionSet) as AppAccessContext["permissions"],
  });
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
