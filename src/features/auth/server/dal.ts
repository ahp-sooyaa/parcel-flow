import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { toCurrentUserContext, type CurrentUserContext } from "./dto";
import { db } from "@/db";
import { appUsers, merchants, permissions, riders, rolePermissions, roles } from "@/db/schema";

import type { RoleSlug } from "@/db/constants";

export async function findCurrentUserContextBySupabaseUserId(
  supabaseUserId: string,
): Promise<CurrentUserContext | null> {
  const rows = await db
    .select({
      appUserId: appUsers.id,
      linkedMerchantId: merchants.appUserId,
      linkedRiderId: riders.appUserId,
      supabaseUserId: appUsers.supabaseUserId,
      fullName: appUsers.fullName,
      email: appUsers.email,
      phoneNumber: appUsers.phoneNumber,
      isActive: appUsers.isActive,
      mustResetPassword: appUsers.mustResetPassword,
      roleId: roles.id,
      roleSlug: roles.slug,
      roleLabel: roles.label,
      permissionSlug: permissions.slug,
    })
    .from(appUsers)
    .innerJoin(roles, eq(appUsers.roleId, roles.id))
    .leftJoin(merchants, and(eq(merchants.appUserId, appUsers.id), isNull(merchants.deletedAt)))
    .leftJoin(riders, and(eq(riders.appUserId, appUsers.id), isNull(riders.deletedAt)))
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

  return toCurrentUserContext({
    appUserId: first.appUserId,
    linkedMerchantId: first.linkedMerchantId,
    linkedRiderId: first.linkedRiderId,
    supabaseUserId: first.supabaseUserId,
    fullName: first.fullName,
    email: first.email,
    phoneNumber: first.phoneNumber,
    isActive: first.isActive,
    mustResetPassword: first.mustResetPassword,
    role: {
      id: first.roleId,
      slug: first.roleSlug,
      label: first.roleLabel,
    },
    permissions: Array.from(permissionSet) as CurrentUserContext["permissions"],
  });
}

export async function findRoleBySlug(slug: RoleSlug) {
  const [role] = await db.select().from(roles).where(eq(roles.slug, slug)).limit(1);

  return role ?? null;
}

export async function findAppUserById(id: string) {
  const [row] = await db
    .select()
    .from(appUsers)
    .where(and(eq(appUsers.id, id), isNull(appUsers.deletedAt)))
    .limit(1);

  return row ?? null;
}

export async function findAppUserByEmail(email: string) {
  const [row] = await db
    .select()
    .from(appUsers)
    .where(and(eq(appUsers.email, email), isNull(appUsers.deletedAt)))
    .limit(1);

  return row ?? null;
}
