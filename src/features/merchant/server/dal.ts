import "server-only";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import {
  toMerchantDetailDto,
  toMerchantListItemDto,
  type MerchantDetailDto,
  type MerchantLinkableUserDto,
  type MerchantListItemDto,
} from "./dto";
import { isMerchantId, normalizeMerchantSearchQuery, toMerchantSearchPattern } from "./utils";
import { db } from "@/db";
import { appUsers, merchants, roles } from "@/db/schema";

import type { RoleSlug } from "@/db/constants";

export async function getMerchantsList(
  input: {
    query?: string;
    limit?: number;
  } = {},
): Promise<MerchantListItemDto[]> {
  const normalizedQuery = normalizeMerchantSearchQuery(input.query);
  const safeLimit = Number.isInteger(input.limit)
    ? Math.min(Math.max(input.limit ?? 50, 1), 200)
    : 50;
  const searchPattern = normalizedQuery ? toMerchantSearchPattern(normalizedQuery) : null;

  const rows = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      phoneNumber: merchants.phoneNumber,
      township: merchants.township,
      address: merchants.address,
      linkedAppUserId: merchants.linkedAppUserId,
      linkedAppUserName: appUsers.fullName,
      createdAt: merchants.createdAt,
    })
    .from(merchants)
    .leftJoin(appUsers, eq(merchants.linkedAppUserId, appUsers.id))
    .where(
      searchPattern
        ? or(ilike(merchants.name, searchPattern), ilike(merchants.phoneNumber, searchPattern))
        : undefined,
    )
    .orderBy(asc(merchants.name), desc(merchants.createdAt))
    .limit(safeLimit);

  return rows.map((row) =>
    toMerchantListItemDto({
      id: row.id,
      name: row.name,
      phoneNumber: row.phoneNumber,
      township: row.township,
      address: row.address,
      linkedAppUserId: row.linkedAppUserId,
      linkedAppUserName: row.linkedAppUserName,
      createdAt: row.createdAt,
    }),
  );
}

export async function getMerchantByIdForViewer(input: {
  merchantId: string;
  viewerRoleSlug: RoleSlug;
  viewerAppUserId: string;
}): Promise<MerchantDetailDto | null> {
  if (!isMerchantId(input.merchantId)) {
    return null;
  }

  if (input.viewerRoleSlug === "merchant") {
    const [row] = await db
      .select({
        id: merchants.id,
        name: merchants.name,
        phoneNumber: merchants.phoneNumber,
        township: merchants.township,
        address: merchants.address,
        notes: merchants.notes,
        linkedAppUserId: merchants.linkedAppUserId,
        linkedAppUserName: appUsers.fullName,
        createdAt: merchants.createdAt,
        updatedAt: merchants.updatedAt,
      })
      .from(merchants)
      .leftJoin(appUsers, eq(merchants.linkedAppUserId, appUsers.id))
      .where(
        and(
          eq(merchants.linkedAppUserId, input.viewerAppUserId),
          eq(merchants.id, input.merchantId),
        ),
      )
      .orderBy(desc(merchants.createdAt))
      .limit(1);

    if (!row) {
      return null;
    }

    return toMerchantDetailDto({
      id: row.id,
      name: row.name,
      phoneNumber: row.phoneNumber,
      township: row.township,
      address: row.address,
      notes: row.notes,
      linkedAppUserId: row.linkedAppUserId,
      linkedAppUserName: row.linkedAppUserName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  const [row] = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      phoneNumber: merchants.phoneNumber,
      township: merchants.township,
      address: merchants.address,
      notes: merchants.notes,
      linkedAppUserId: merchants.linkedAppUserId,
      linkedAppUserName: appUsers.fullName,
      createdAt: merchants.createdAt,
      updatedAt: merchants.updatedAt,
    })
    .from(merchants)
    .leftJoin(appUsers, eq(merchants.linkedAppUserId, appUsers.id))
    .where(eq(merchants.id, input.merchantId))
    .limit(1);

  if (!row) {
    return null;
  }

  return toMerchantDetailDto({
    id: row.id,
    name: row.name,
    phoneNumber: row.phoneNumber,
    township: row.township,
    address: row.address,
    notes: row.notes,
    linkedAppUserId: row.linkedAppUserId,
    linkedAppUserName: row.linkedAppUserName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function createMerchant(input: {
  name: string;
  phoneNumber: string | null;
  address: string;
  township: string;
  notes: string | null;
  linkedAppUserId: string | null;
}) {
  const [created] = await db
    .insert(merchants)
    .values({
      name: input.name,
      phoneNumber: input.phoneNumber,
      address: input.address,
      township: input.township,
      notes: input.notes,
      linkedAppUserId: input.linkedAppUserId,
    })
    .returning({ id: merchants.id });

  return created;
}

export async function findMerchantByLinkedAppUserId(linkedAppUserId: string) {
  const [row] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.linkedAppUserId, linkedAppUserId))
    .limit(1);

  return row ?? null;
}

export async function getMerchantLinkableUsers(): Promise<MerchantLinkableUserDto[]> {
  return db
    .select({
      id: appUsers.id,
      fullName: appUsers.fullName,
      email: appUsers.email,
    })
    .from(appUsers)
    .innerJoin(roles, eq(appUsers.roleId, roles.id))
    .where(and(eq(roles.slug, "merchant"), eq(appUsers.isActive, true)))
    .orderBy(asc(appUsers.fullName));
}
