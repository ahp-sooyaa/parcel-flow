import "server-only";
import { desc, eq } from "drizzle-orm";
import {
  toAppUserDetailDto,
  toAppUserListItemDto,
  type AppUserDetailDto,
  type AppUserListItemDto,
} from "./dto";
import { db } from "@/db";
import { appUsers, roles } from "@/db/schema";

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
    .orderBy(desc(appUsers.createdAt));

  return rows.map((row) => toAppUserListItemDto(row));
}

export async function getUserById(id: string): Promise<AppUserDetailDto | null> {
  const [row] = await db
    .select({
      id: appUsers.id,
      fullName: appUsers.fullName,
      email: appUsers.email,
      phoneNumber: appUsers.phoneNumber,
      isActive: appUsers.isActive,
      mustResetPassword: appUsers.mustResetPassword,
      roleSlug: roles.slug,
      roleLabel: roles.label,
      createdAt: appUsers.createdAt,
      updatedAt: appUsers.updatedAt,
    })
    .from(appUsers)
    .innerJoin(roles, eq(appUsers.roleId, roles.id))
    .where(eq(appUsers.id, id))
    .limit(1);

  return row ? toAppUserDetailDto(row) : null;
}
