import "server-only";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import {
  toProfilePageDto,
  toAppUserDetailDto,
  toAppUserListItemDto,
  type ProfilePageDto,
  type AppUserDetailDto,
  type AppUserListItemDto,
} from "./dto";
import { db } from "@/db";
import { appUsers, roles } from "@/db/schema";

import type { RoleSlug } from "@/db/constants";

type E2EAuthHeader = {
  authenticated?: boolean;
};

async function getStubbedProfileForE2E(): Promise<ProfilePageDto | null> {
  if (process.env.AUTH_E2E_STUB_MODE !== "1") {
    return null;
  }

  const requestHeaders = await headers();
  const raw = requestHeaders.get("x-parcel-flow-e2e-auth");

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as E2EAuthHeader;

    if (parsed.authenticated !== true) {
      return null;
    }

    return toProfilePageDto({
      fullName: "E2E Test User",
      email: "e2e-user@example.com",
      phoneNumber: null,
    });
  } catch {
    return null;
  }
}

export async function getProfileByAppUserId(appUserId: string): Promise<ProfilePageDto | null> {
  const stubbed = await getStubbedProfileForE2E();

  if (stubbed) {
    return stubbed;
  }

  const [row] = await db
    .select({
      fullName: appUsers.fullName,
      email: appUsers.email,
      phoneNumber: appUsers.phoneNumber,
    })
    .from(appUsers)
    .where(and(eq(appUsers.id, appUserId), isNull(appUsers.deletedAt)))
    .limit(1);

  return row ? toProfilePageDto(row) : null;
}

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
    .where(and(eq(appUsers.id, id), isNull(appUsers.deletedAt)))
    .limit(1);

  return row ? toAppUserDetailDto(row) : null;
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
