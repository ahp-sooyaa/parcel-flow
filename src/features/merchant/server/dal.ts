import "server-only";
import { and, asc, desc, eq, ilike, isNull, or } from "drizzle-orm";
import {
  toMerchantDetailDto,
  toMerchantListItemDto,
  toMerchantProfileDto,
  type MerchantDetailDto,
  type MerchantListItemDto,
  type MerchantProfileDto,
} from "./dto";
import { isMerchantId, normalizeMerchantSearchQuery, toMerchantSearchPattern } from "./utils";
import { db } from "@/db";
import { appUsers, merchants, townships } from "@/db/schema";

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
      id: merchants.appUserId,
      shopName: merchants.shopName,
      contactName: appUsers.fullName,
      phoneNumber: appUsers.phoneNumber,
      townshipName: townships.name,
      defaultPickupAddress: merchants.defaultPickupAddress,
      createdAt: merchants.createdAt,
    })
    .from(merchants)
    .innerJoin(appUsers, eq(merchants.appUserId, appUsers.id))
    .leftJoin(townships, eq(merchants.pickupTownshipId, townships.id))
    .where(
      and(
        isNull(merchants.deletedAt),
        isNull(appUsers.deletedAt),
        searchPattern
          ? or(ilike(merchants.shopName, searchPattern), ilike(appUsers.fullName, searchPattern))
          : undefined,
      ),
    )
    .orderBy(asc(merchants.shopName), desc(merchants.createdAt))
    .limit(safeLimit);

  return rows.map((row) =>
    toMerchantListItemDto({
      id: row.id,
      shopName: row.shopName,
      contactName: row.contactName,
      phoneNumber: row.phoneNumber,
      townshipName: row.townshipName,
      defaultPickupAddress: row.defaultPickupAddress,
      createdAt: row.createdAt,
    }),
  );
}

export async function getMerchantById(merchantId: string): Promise<MerchantDetailDto | null> {
  if (!isMerchantId(merchantId)) {
    return null;
  }

  const [row] = await db
    .select({
      id: merchants.appUserId,
      shopName: merchants.shopName,
      contactName: appUsers.fullName,
      email: appUsers.email,
      phoneNumber: appUsers.phoneNumber,
      pickupTownshipId: merchants.pickupTownshipId,
      townshipName: townships.name,
      defaultPickupAddress: merchants.defaultPickupAddress,
      notes: merchants.notes,
      createdAt: merchants.createdAt,
      updatedAt: merchants.updatedAt,
    })
    .from(merchants)
    .innerJoin(appUsers, eq(merchants.appUserId, appUsers.id))
    .leftJoin(townships, eq(merchants.pickupTownshipId, townships.id))
    .where(
      and(
        eq(merchants.appUserId, merchantId),
        isNull(merchants.deletedAt),
        isNull(appUsers.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return toMerchantDetailDto({
    id: row.id,
    shopName: row.shopName,
    contactName: row.contactName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    pickupTownshipId: row.pickupTownshipId,
    townshipName: row.townshipName,
    defaultPickupAddress: row.defaultPickupAddress,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function getMerchantProfileByAppUserId(
  appUserId: string,
): Promise<MerchantProfileDto | null> {
  if (!isMerchantId(appUserId)) {
    return null;
  }

  const [row] = await db
    .select({
      appUserId: merchants.appUserId,
      shopName: merchants.shopName,
      pickupTownshipId: merchants.pickupTownshipId,
      defaultPickupAddress: merchants.defaultPickupAddress,
      notes: merchants.notes,
      createdAt: merchants.createdAt,
      updatedAt: merchants.updatedAt,
    })
    .from(merchants)
    .where(and(eq(merchants.appUserId, appUserId), isNull(merchants.deletedAt)))
    .limit(1);

  return row ? toMerchantProfileDto(row) : null;
}

export async function createMerchantProfile(input: {
  appUserId: string;
  shopName: string;
  pickupTownshipId: string | null;
  defaultPickupAddress: string | null;
  notes: string | null;
}) {
  const [created] = await db
    .insert(merchants)
    .values({
      appUserId: input.appUserId,
      shopName: input.shopName,
      pickupTownshipId: input.pickupTownshipId,
      defaultPickupAddress: input.defaultPickupAddress,
      notes: input.notes,
    })
    .returning({ id: merchants.appUserId });

  return created;
}

export async function findMerchantProfileLinkByAppUserId(appUserId: string) {
  const [row] = await db
    .select({ appUserId: merchants.appUserId })
    .from(merchants)
    .where(and(eq(merchants.appUserId, appUserId), isNull(merchants.deletedAt)))
    .limit(1);

  return row ?? null;
}
