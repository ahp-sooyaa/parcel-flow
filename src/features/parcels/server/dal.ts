import { createHash } from "node:crypto";

import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  appUsers,
  financialItems,
  merchants,
  parcels,
  parcelCorrectionLogs,
  parcelStatusLogs,
  riders,
  townships,
} from "@/db/schema";
import type {
  AdminParcelAssignmentCountsDto,
  AdminParcelListFiltersDto,
  AdminParcelListPageDto,
  CorrectParcelRiderInputDto,
  CorrectParcelStatusInputDto,
  CreateParcelInputDto,
  MerchantParcelListFiltersDto,
  MerchantParcelListPageDto,
  ParcelCorrectionLogDto,
  ParcelCorrectionSideEffectsDto,
  ParcelListItemDto,
  ParcelSummaryDto,
  RiderParcelListFiltersDto,
  RiderParcelListPageDto,
  RiderParcelTabCountsDto,
  UpdateParcelInputDto,
} from "@/features/parcels/server/dto";
import { ParcelOperationError } from "@/features/parcels/server/errors";
import { getRiderParcelTabStatuses, riderParcelPageSize } from "@/features/parcels/server/dto";
import {
  appendActiveParcelFailureNote,
  deactivateLatestActiveParcelFailureNote,
  getActiveParcelFailureNote,
  parseParcelFailureNotes,
  removeLatestActiveParcelFailureNote,
  updateLatestActiveParcelFailureNote,
} from "@/features/parcels/server/failure-notes";
import { calculateAmountToCollect, generateParcelCode } from "@/features/parcels/server/utils";
import { recomputeParcelRiderPayoutStatuses } from "@/features/rider-payouts/server/utils";
import {
  isDeliveryAttemptRiderWaySource,
  isFinancialItemType,
  isRiderWaySource,
  parcelStatuses,
} from "@/lib/domain";
import type { FinancialItemType, ParcelStatus, RiderWaySource, UserRole } from "@/lib/domain";
import { canChangeParcelStatus } from "@/lib/permissions";
import { CACHE_TAGS, merchantParcelsTag, riderParcelsTag } from "@/lib/cache-tags";

const parcelStatusSchema = z.enum(parcelStatuses);
const assignmentEligibleStatuses = ["at_office", "postpone", "canceled_returned"] as const;

function mapParcel(
  row: {
    id: string;
    parcelCode: string;
    merchantId: string;
    merchantName: string;
    receiverName: string;
    receiverPhoneNumber: string;
    receiverAddress: string;
    specialNotes: string | null;
    deliveryFailureNote: unknown;
    townshipId: string;
    townshipName: string;
    parcelType: string;
    codAmount: number;
    deliveryFee: number;
    weightKg: string;
    parcelWidthCm: string | null;
    parcelHeightCm: string | null;
    parcelLengthCm: string | null;
    proofOfDeliveryImagesKeys: string[] | null;
    riderId: string | null;
    riderName: string | null;
    status: string;
    createdAt: Date;
  },
  correctionLogs: ParcelCorrectionLogDto[] = [],
  correctionStateToken = createFinancialItemsFingerprint([]),
): ParcelListItemDto {
  const failureNotes = parseParcelFailureNotes(row.deliveryFailureNote);
  const activeFailureNote = getActiveParcelFailureNote(failureNotes);

  return {
    id: row.id,
    parcelCode: row.parcelCode,
    merchantId: row.merchantId,
    merchantName: row.merchantName,
    riderId: row.riderId,
    receiverName: row.receiverName,
    receiverPhoneNumber: row.receiverPhoneNumber,
    receiverAddress: row.receiverAddress,
    specialNotes: row.specialNotes,
    failureNotes,
    activeFailureNote,
    townshipId: row.townshipId,
    townshipName: row.townshipName,
    parcelType: row.parcelType === "non_cod" ? "non_cod" : "cod",
    codAmount: row.codAmount,
    deliveryFee: row.deliveryFee,
    weightKg: Number(row.weightKg),
    parcelWidthCm: row.parcelWidthCm === null ? null : Number(row.parcelWidthCm),
    parcelHeightCm: row.parcelHeightCm === null ? null : Number(row.parcelHeightCm),
    parcelLengthCm: row.parcelLengthCm === null ? null : Number(row.parcelLengthCm),
    proofOfDeliveryImagesKeys: row.proofOfDeliveryImagesKeys ?? [],
    riderName: row.riderName,
    status: parcelStatusSchema.parse(row.status),
    hasUnresolvedFailureReview:
      row.status === "on_the_way" && row.riderId !== null && activeFailureNote !== null,
    correctionStateToken,
    correctionLogs,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseNullableParcelStatus(status: string | null): ParcelStatus | null {
  if (status === null) {
    return null;
  }

  return parcelStatusSchema.parse(status);
}

function hasSummaryArray(value: unknown): value is { summary: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "summary" in value &&
    Array.isArray(value.summary)
  );
}

function parseCorrectionSideEffects(value: unknown): ParcelCorrectionSideEffectsDto {
  if (hasSummaryArray(value)) {
    return {
      summary: value.summary.filter((item): item is string => typeof item === "string"),
    };
  }

  return { summary: [] };
}

export type ParcelRealtimeViewerScope =
  | { role: "super_admin" | "office_admin" }
  | { role: "merchant"; userId: string }
  | { role: "rider"; userId: string };

export async function listParcels(): Promise<ParcelListItemDto[]> {
  return listParcelsByScope({});
}

export async function listParcelsForMerchantUser(userId: string): Promise<ParcelListItemDto[]> {
  return listParcelsByScope({ merchantUserId: userId });
}

export async function listMerchantParcelsPageForUser(
  userId: string,
  filters: MerchantParcelListFiltersDto,
): Promise<MerchantParcelListPageDto> {
  "use cache";
  cacheLife("minutes");
  cacheTag(merchantParcelsTag(userId), CACHE_TAGS.parcels);

  const hasAnyParcelsWhere = and(isNull(parcels.deletedAt), eq(merchants.userId, userId));
  const filteredWhere = buildMerchantParcelWhere(userId, filters);

  const [hasAnyParcelsRow, totalCountRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(parcels)
      .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
      .where(hasAnyParcelsWhere)
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(parcels)
      .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
      .where(filteredWhere)
      .then((rows) => rows[0]),
  ]);

  const hasAnyParcels = (hasAnyParcelsRow?.count ?? 0) > 0;
  const totalCount = totalCountRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const offset = (page - 1) * filters.pageSize;

  const rows = await db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantId: parcels.merchantId,
      merchantName: merchants.shopName,
      receiverName: parcels.receiverName,
      receiverPhoneNumber: parcels.receiverPhoneNumber,
      receiverAddress: parcels.receiverAddress,
      specialNotes: parcels.specialNotes,
      deliveryFailureNote: parcels.deliveryFailureNote,
      townshipId: parcels.townshipId,
      townshipName: townships.name,
      parcelType: parcels.parcelType,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      weightKg: parcels.weightKg,
      parcelWidthCm: parcels.parcelWidthCm,
      parcelHeightCm: parcels.parcelHeightCm,
      parcelLengthCm: parcels.parcelLengthCm,
      proofOfDeliveryImagesKeys: parcels.proofOfDeliveryImagesKeys,
      riderId: parcels.riderId,
      riderName: appUsers.name,
      status: parcels.status,
      createdAt: parcels.createdAt,
    })
    .from(parcels)
    .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
    .innerJoin(townships, eq(townships.id, parcels.townshipId))
    .leftJoin(riders, eq(riders.id, parcels.riderId))
    .leftJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(filteredWhere)
    .orderBy(desc(parcels.createdAt), desc(parcels.parcelCode))
    .limit(filters.pageSize)
    .offset(offset);

  return {
    parcels: rows.map((row) => mapParcel(row)),
    page,
    pageSize: filters.pageSize,
    totalCount,
    totalPages,
    hasAnyParcels,
  };
}

function mapAdminListParcel(row: {
  id: string;
  parcelCode: string;
  merchantId: string;
  merchantName: string;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverAddress: string;
  specialNotes: string | null;
  deliveryFailureNote: unknown;
  townshipId: string;
  townshipName: string;
  parcelType: string;
  codAmount: number;
  deliveryFee: number;
  riderId: string | null;
  riderName: string | null;
  status: string;
  createdAt: Date;
}): ParcelListItemDto {
  const failureNotes = parseParcelFailureNotes(row.deliveryFailureNote);
  const activeFailureNote = getActiveParcelFailureNote(failureNotes);

  return {
    id: row.id,
    parcelCode: row.parcelCode,
    merchantId: row.merchantId,
    merchantName: row.merchantName,
    riderId: row.riderId,
    receiverName: row.receiverName,
    receiverPhoneNumber: row.receiverPhoneNumber,
    receiverAddress: row.receiverAddress,
    specialNotes: row.specialNotes,
    failureNotes,
    activeFailureNote,
    townshipId: row.townshipId,
    townshipName: row.townshipName,
    parcelType: row.parcelType === "non_cod" ? "non_cod" : "cod",
    codAmount: row.codAmount,
    deliveryFee: row.deliveryFee,
    weightKg: 0,
    parcelWidthCm: null,
    parcelHeightCm: null,
    parcelLengthCm: null,
    proofOfDeliveryImagesKeys: [],
    riderName: row.riderName,
    status: parcelStatusSchema.parse(row.status),
    hasUnresolvedFailureReview:
      row.status === "on_the_way" && row.riderId !== null && activeFailureNote !== null,
    correctionStateToken: "",
    correctionLogs: [],
    createdAt: row.createdAt.toISOString(),
  };
}

const adminParcelListSelect = {
  id: parcels.id,
  parcelCode: parcels.parcelCode,
  merchantId: parcels.merchantId,
  merchantName: merchants.shopName,
  receiverName: parcels.receiverName,
  receiverPhoneNumber: parcels.receiverPhoneNumber,
  receiverAddress: parcels.receiverAddress,
  specialNotes: parcels.specialNotes,
  deliveryFailureNote: parcels.deliveryFailureNote,
  townshipId: parcels.townshipId,
  townshipName: townships.name,
  parcelType: parcels.parcelType,
  codAmount: parcels.codAmount,
  deliveryFee: parcels.deliveryFee,
  riderId: parcels.riderId,
  riderName: appUsers.name,
  status: parcels.status,
  createdAt: parcels.createdAt,
};

function buildAdminParcelSharedWhere(
  filters: Pick<AdminParcelListFiltersDto, "searchTerm" | "townshipName" | "statuses">,
) {
  const normalizedSearchTerm = filters.searchTerm.trim();

  return and(
    isNull(parcels.deletedAt),
    filters.townshipName ? eq(townships.name, filters.townshipName) : undefined,
    filters.statuses.length > 0 ? inArray(parcels.status, filters.statuses) : undefined,
    normalizedSearchTerm
      ? or(
          ilike(parcels.parcelCode, `%${normalizedSearchTerm}%`),
          ilike(parcels.receiverName, `%${normalizedSearchTerm}%`),
          ilike(parcels.receiverPhoneNumber, `%${normalizedSearchTerm}%`),
          ilike(merchants.shopName, `%${normalizedSearchTerm}%`),
        )
      : undefined,
  );
}

function buildAdminParcelWhere(filters: AdminParcelListFiltersDto) {
  return and(
    buildAdminParcelSharedWhere(filters),
    filters.assignment === "unassigned" ? isNull(parcels.riderId) : undefined,
    filters.assignment === "assigned" ? isNotNull(parcels.riderId) : undefined,
    filters.assignment === "need_review"
      ? and(
          eq(parcels.status, "on_the_way"),
          isNotNull(parcels.riderId),
          sql`${parcels.deliveryFailureNote} @> '[{"status":"active"}]'::jsonb`,
        )
      : undefined,
  );
}

async function getAdminParcelAssignmentCounts(
  filters: Pick<AdminParcelListFiltersDto, "searchTerm" | "townshipName" | "statuses">,
): Promise<AdminParcelAssignmentCountsDto> {
  const sharedWhere = buildAdminParcelSharedWhere(filters);
  const [countsRow] = await db
    .select({
      all: sql<number>`count(*)`.mapWith(Number),
      unassigned: sql<number>`count(*) filter (where ${parcels.riderId} is null)`.mapWith(Number),
      assigned: sql<number>`count(*) filter (where ${parcels.riderId} is not null)`.mapWith(Number),
      needReview:
        sql<number>`count(*) filter (where ${parcels.status} = 'on_the_way' and ${parcels.riderId} is not null and ${parcels.deliveryFailureNote} @> '[{"status":"active"}]'::jsonb)`.mapWith(
          Number,
        ),
    })
    .from(parcels)
    .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
    .innerJoin(townships, eq(townships.id, parcels.townshipId))
    .where(sharedWhere);

  return {
    all: countsRow?.all ?? 0,
    unassigned: countsRow?.unassigned ?? 0,
    assigned: countsRow?.assigned ?? 0,
    need_review: countsRow?.needReview ?? 0,
  };
}

export async function listAdminParcelsPage(
  filters: AdminParcelListFiltersDto,
): Promise<AdminParcelListPageDto> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.parcels);

  const hasAnyParcelsWhere = isNull(parcels.deletedAt);
  const filteredWhere = buildAdminParcelWhere(filters);
  const sharedFilters = {
    searchTerm: filters.searchTerm,
    townshipName: filters.townshipName,
    statuses: filters.statuses,
  };

  const [hasAnyParcelsRow, totalCountRow, assignmentCounts] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(parcels)
      .where(hasAnyParcelsWhere)
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(parcels)
      .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
      .innerJoin(townships, eq(townships.id, parcels.townshipId))
      .where(filteredWhere)
      .then((rows) => rows[0]),
    getAdminParcelAssignmentCounts(sharedFilters),
  ]);

  const hasAnyParcels = (hasAnyParcelsRow?.count ?? 0) > 0;
  const totalCount = totalCountRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const offset = (page - 1) * filters.pageSize;

  const rows = await db
    .select(adminParcelListSelect)
    .from(parcels)
    .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
    .innerJoin(townships, eq(townships.id, parcels.townshipId))
    .leftJoin(riders, eq(riders.id, parcels.riderId))
    .leftJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(filteredWhere)
    .orderBy(desc(parcels.createdAt), desc(parcels.parcelCode))
    .limit(filters.pageSize)
    .offset(offset);

  return {
    parcels: rows.map((row) => mapAdminListParcel(row)),
    page,
    pageSize: filters.pageSize,
    totalCount,
    totalPages,
    hasAnyParcels,
    assignmentCounts,
  };
}

function buildRiderParcelSharedWhere(userId: string, filters: RiderParcelListFiltersDto) {
  const normalizedSearchTerm = filters.searchTerm.trim();

  return and(
    isNull(parcels.deletedAt),
    eq(riders.userId, userId),
    filters.townshipName ? eq(townships.name, filters.townshipName) : undefined,
    filters.statuses.length > 0 ? inArray(parcels.status, filters.statuses) : undefined,
    normalizedSearchTerm
      ? or(
          ilike(parcels.parcelCode, `%${normalizedSearchTerm}%`),
          ilike(parcels.receiverName, `%${normalizedSearchTerm}%`),
          ilike(parcels.receiverPhoneNumber, `%${normalizedSearchTerm}%`),
        )
      : undefined,
  );
}

function buildRiderParcelWhere(userId: string, filters: RiderParcelListFiltersDto) {
  return and(
    buildRiderParcelSharedWhere(userId, filters),
    inArray(parcels.status, getRiderParcelTabStatuses(filters.tab)),
  );
}

async function getRiderParcelTabCounts(
  userId: string,
  filters: Pick<RiderParcelListFiltersDto, "searchTerm" | "townshipName" | "statuses">,
): Promise<RiderParcelTabCountsDto> {
  const sharedWhere = buildRiderParcelSharedWhere(userId, {
    ...filters,
    tab: "to_deliver",
    page: 1,
    pageSize: riderParcelPageSize,
  } as RiderParcelListFiltersDto);
  const [countsRow] = await db
    .select({
      toDeliver:
        sql<number>`count(*) filter (where ${parcels.status} in ('at_office', 'on_the_way', 'canceled_returned'))`.mapWith(
          Number,
        ),
      delivered: sql<number>`count(*) filter (where ${parcels.status} = 'delivered')`.mapWith(
        Number,
      ),
      returned:
        sql<number>`count(*) filter (where ${parcels.status} = 'returned_to_merchant')`.mapWith(
          Number,
        ),
    })
    .from(parcels)
    .innerJoin(riders, eq(riders.id, parcels.riderId))
    .innerJoin(townships, eq(townships.id, parcels.townshipId))
    .where(sharedWhere);

  return {
    to_deliver: countsRow?.toDeliver ?? 0,
    delivered: countsRow?.delivered ?? 0,
    returned: countsRow?.returned ?? 0,
  };
}

export async function listRiderParcelsPageForUser(
  userId: string,
  filters: RiderParcelListFiltersDto,
): Promise<RiderParcelListPageDto> {
  "use cache";
  cacheLife("minutes");
  cacheTag(riderParcelsTag(userId), CACHE_TAGS.parcels);

  const hasAnyParcelsWhere = and(isNull(parcels.deletedAt), eq(riders.userId, userId));
  const filteredWhere = buildRiderParcelWhere(userId, filters);
  const sharedFilters = {
    searchTerm: filters.searchTerm,
    townshipName: filters.townshipName,
    statuses: filters.statuses,
  };

  const [hasAnyParcelsRow, totalCountRow, tabCounts] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(parcels)
      .innerJoin(riders, eq(riders.id, parcels.riderId))
      .where(hasAnyParcelsWhere)
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(parcels)
      .innerJoin(riders, eq(riders.id, parcels.riderId))
      .innerJoin(townships, eq(townships.id, parcels.townshipId))
      .where(filteredWhere)
      .then((rows) => rows[0]),
    getRiderParcelTabCounts(userId, sharedFilters),
  ]);

  const hasAnyParcels = (hasAnyParcelsRow?.count ?? 0) > 0;
  const totalCount = totalCountRow?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const offset = (page - 1) * filters.pageSize;

  const rows = await db
    .select(adminParcelListSelect)
    .from(parcels)
    .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
    .innerJoin(townships, eq(townships.id, parcels.townshipId))
    .innerJoin(riders, eq(riders.id, parcels.riderId))
    .leftJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(filteredWhere)
    .orderBy(desc(parcels.createdAt), desc(parcels.parcelCode))
    .limit(filters.pageSize)
    .offset(offset);

  return {
    parcels: rows.map((row) => mapAdminListParcel(row)),
    page,
    pageSize: filters.pageSize,
    totalCount,
    totalPages,
    hasAnyParcels,
    tabCounts,
  };
}

export async function listParcelsForRiderUser(userId: string): Promise<ParcelListItemDto[]> {
  return listParcelsByScope({ riderUserId: userId });
}

export async function getParcelByIdForRealtimeScope(
  parcelId: string,
  scope: ParcelRealtimeViewerScope,
): Promise<ParcelListItemDto | null> {
  const [row] = await db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantId: parcels.merchantId,
      merchantName: merchants.shopName,
      receiverName: parcels.receiverName,
      receiverPhoneNumber: parcels.receiverPhoneNumber,
      receiverAddress: parcels.receiverAddress,
      specialNotes: parcels.specialNotes,
      deliveryFailureNote: parcels.deliveryFailureNote,
      townshipId: parcels.townshipId,
      townshipName: townships.name,
      parcelType: parcels.parcelType,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      weightKg: parcels.weightKg,
      parcelWidthCm: parcels.parcelWidthCm,
      parcelHeightCm: parcels.parcelHeightCm,
      parcelLengthCm: parcels.parcelLengthCm,
      proofOfDeliveryImagesKeys: parcels.proofOfDeliveryImagesKeys,
      riderId: parcels.riderId,
      riderName: appUsers.name,
      status: parcels.status,
      createdAt: parcels.createdAt,
    })
    .from(parcels)
    .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
    .innerJoin(townships, eq(townships.id, parcels.townshipId))
    .leftJoin(riders, eq(riders.id, parcels.riderId))
    .leftJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(
      and(
        isNull(parcels.deletedAt),
        eq(parcels.id, parcelId),
        scope.role === "merchant" ? eq(merchants.userId, scope.userId) : undefined,
        scope.role === "rider" ? eq(riders.userId, scope.userId) : undefined,
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  if (scope.role !== "super_admin" && scope.role !== "office_admin") {
    return mapParcel(row);
  }

  const [correctionLogs, correctionStateTokens] = await Promise.all([
    getCorrectionLogsByParcelIds([row.id]),
    getFinancialItemFingerprintsByParcelIds([row.id]),
  ]);

  return mapParcel(
    row,
    correctionLogs.get(row.id) ?? [],
    correctionStateTokens.get(row.id) ?? createFinancialItemsFingerprint([]),
  );
}

export async function getParcelByIdForRealtimeListScope(
  parcelId: string,
  scope: ParcelRealtimeViewerScope,
): Promise<ParcelListItemDto | null> {
  const [row] = await db
    .select(adminParcelListSelect)
    .from(parcels)
    .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
    .innerJoin(townships, eq(townships.id, parcels.townshipId))
    .leftJoin(riders, eq(riders.id, parcels.riderId))
    .leftJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(
      and(
        isNull(parcels.deletedAt),
        eq(parcels.id, parcelId),
        scope.role === "merchant" ? eq(merchants.userId, scope.userId) : undefined,
        scope.role === "rider" ? eq(riders.userId, scope.userId) : undefined,
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return mapAdminListParcel(row);
}

async function listParcelsByScope(scope: {
  merchantUserId?: string;
  riderUserId?: string;
}): Promise<ParcelListItemDto[]> {
  const rows = await db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantId: parcels.merchantId,
      merchantName: merchants.shopName,
      receiverName: parcels.receiverName,
      receiverPhoneNumber: parcels.receiverPhoneNumber,
      receiverAddress: parcels.receiverAddress,
      specialNotes: parcels.specialNotes,
      deliveryFailureNote: parcels.deliveryFailureNote,
      townshipId: parcels.townshipId,
      townshipName: townships.name,
      parcelType: parcels.parcelType,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      weightKg: parcels.weightKg,
      parcelWidthCm: parcels.parcelWidthCm,
      parcelHeightCm: parcels.parcelHeightCm,
      parcelLengthCm: parcels.parcelLengthCm,
      proofOfDeliveryImagesKeys: parcels.proofOfDeliveryImagesKeys,
      riderId: parcels.riderId,
      riderName: appUsers.name,
      status: parcels.status,
      createdAt: parcels.createdAt,
    })
    .from(parcels)
    .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
    .innerJoin(townships, eq(townships.id, parcels.townshipId))
    .leftJoin(riders, eq(riders.id, parcels.riderId))
    .leftJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(
      and(
        isNull(parcels.deletedAt),
        scope.merchantUserId ? eq(merchants.userId, scope.merchantUserId) : undefined,
        scope.riderUserId ? eq(riders.userId, scope.riderUserId) : undefined,
      ),
    );

  if (scope.merchantUserId || scope.riderUserId) {
    return rows.map((row) => mapParcel(row));
  }

  const [correctionLogs, correctionStateTokens] = await Promise.all([
    getCorrectionLogsByParcelIds(rows.map((row) => row.id)),
    getFinancialItemFingerprintsByParcelIds(rows.map((row) => row.id)),
  ]);

  return rows.map((row) =>
    mapParcel(
      row,
      correctionLogs.get(row.id) ?? [],
      correctionStateTokens.get(row.id) ?? createFinancialItemsFingerprint([]),
    ),
  );
}

function buildMerchantParcelWhere(userId: string, filters: MerchantParcelListFiltersDto) {
  const createdAtRange = filters.createdOn ? getDayRange(filters.createdOn) : null;
  const normalizedSearchTerm = filters.searchTerm.trim();

  return and(
    isNull(parcels.deletedAt),
    eq(merchants.userId, userId),
    filters.status === "on_the_way" || filters.status === "delivered"
      ? eq(parcels.status, filters.status)
      : undefined,
    createdAtRange
      ? and(gte(parcels.createdAt, createdAtRange.start), lt(parcels.createdAt, createdAtRange.end))
      : undefined,
    normalizedSearchTerm
      ? or(
          ilike(parcels.receiverName, `%${normalizedSearchTerm}%`),
          ilike(parcels.receiverPhoneNumber, `%${normalizedSearchTerm}%`),
        )
      : undefined,
  );
}

function getDayRange(day: string) {
  const start = new Date(`${day}T00:00:00+07:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

async function getCorrectionLogsByParcelIds(parcelIds: string[]) {
  const correctionLogMap = new Map<string, ParcelCorrectionLogDto[]>();
  const uniqueParcelIds = Array.from(new Set(parcelIds));

  if (uniqueParcelIds.length === 0) {
    return correctionLogMap;
  }

  const rows = await db
    .select({
      id: parcelCorrectionLogs.id,
      parcelId: parcelCorrectionLogs.parcelId,
      correctionType: parcelCorrectionLogs.correctionType,
      oldStatus: parcelCorrectionLogs.oldStatus,
      newStatus: parcelCorrectionLogs.newStatus,
      oldRiderId: parcelCorrectionLogs.oldRiderId,
      newRiderId: parcelCorrectionLogs.newRiderId,
      reason: parcelCorrectionLogs.reason,
      sideEffects: parcelCorrectionLogs.sideEffects,
      createdBy: parcelCorrectionLogs.createdBy,
      createdAt: parcelCorrectionLogs.createdAt,
    })
    .from(parcelCorrectionLogs)
    .where(inArray(parcelCorrectionLogs.parcelId, uniqueParcelIds))
    .orderBy(desc(parcelCorrectionLogs.createdAt));

  const riderIds = Array.from(
    new Set(
      rows
        .flatMap((row) => [row.oldRiderId, row.newRiderId])
        .filter((riderId): riderId is string => riderId !== null),
    ),
  );
  const actorIds = Array.from(
    new Set(rows.map((row) => row.createdBy).filter((userId): userId is string => userId !== null)),
  );

  const riderNameRows =
    riderIds.length > 0
      ? await db
          .select({ riderId: riders.id, riderName: appUsers.name })
          .from(riders)
          .innerJoin(appUsers, eq(appUsers.id, riders.userId))
          .where(inArray(riders.id, riderIds))
      : [];
  const actorNameRows =
    actorIds.length > 0
      ? await db
          .select({ userId: appUsers.id, userName: appUsers.name })
          .from(appUsers)
          .where(inArray(appUsers.id, actorIds))
      : [];

  const riderNameMap = new Map(riderNameRows.map((row) => [row.riderId, row.riderName]));
  const actorNameMap = new Map(actorNameRows.map((row) => [row.userId, row.userName]));

  for (const row of rows) {
    const correctionLog: ParcelCorrectionLogDto = {
      id: row.id,
      correctionType: row.correctionType === "rider" ? "rider" : "status",
      oldStatus: parseNullableParcelStatus(row.oldStatus),
      newStatus: parseNullableParcelStatus(row.newStatus),
      oldRiderId: row.oldRiderId,
      oldRiderName: row.oldRiderId ? (riderNameMap.get(row.oldRiderId) ?? null) : null,
      newRiderId: row.newRiderId,
      newRiderName: row.newRiderId ? (riderNameMap.get(row.newRiderId) ?? null) : null,
      reason: row.reason,
      sideEffects: parseCorrectionSideEffects(row.sideEffects),
      createdByName: row.createdBy ? (actorNameMap.get(row.createdBy) ?? null) : null,
      createdAt: row.createdAt.toISOString(),
    };

    const parcelLogs = correctionLogMap.get(row.parcelId) ?? [];
    parcelLogs.push(correctionLog);
    correctionLogMap.set(row.parcelId, parcelLogs);
  }

  return correctionLogMap;
}

async function getFinancialItemFingerprintsByParcelIds(parcelIds: string[]) {
  const fingerprintMap = new Map<string, string>();
  const uniqueParcelIds = Array.from(new Set(parcelIds));

  if (uniqueParcelIds.length === 0) {
    return fingerprintMap;
  }

  const rows = await db
    .select({
      id: financialItems.id,
      parcelId: financialItems.parcelId,
      riderId: financialItems.riderId,
      itemType: financialItems.itemType,
      riderWaySource: financialItems.riderWaySource,
      amount: financialItems.amount,
      status: financialItems.status,
      merchantSettlementId: financialItems.merchantSettlementId,
      riderPayoutId: financialItems.riderPayoutId,
      createdAt: financialItems.createdAt,
      updatedAt: financialItems.updatedAt,
    })
    .from(financialItems)
    .where(inArray(financialItems.parcelId, uniqueParcelIds));

  const rowsByParcelId = new Map<string, Array<CorrectionFinancialItem & { parcelId: string }>>();

  for (const row of rows) {
    const parcelId = row.parcelId;

    if (!parcelId) {
      continue;
    }

    const parcelRows = rowsByParcelId.get(parcelId) ?? [];
    parcelRows.push({
      id: row.id,
      parcelId,
      riderId: row.riderId,
      itemType: row.itemType,
      riderWaySource: row.riderWaySource,
      amount: row.amount,
      status: row.status,
      merchantSettlementId: row.merchantSettlementId,
      riderPayoutId: row.riderPayoutId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
    rowsByParcelId.set(parcelId, parcelRows);
  }

  for (const parcelId of uniqueParcelIds) {
    fingerprintMap.set(
      parcelId,
      createFinancialItemsFingerprint(rowsByParcelId.get(parcelId) ?? []),
    );
  }

  return fingerprintMap;
}

export async function getParcelSummary(): Promise<ParcelSummaryDto> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.parcelSummary, CACHE_TAGS.parcels);

  const [summaryRow] = await db
    .select({
      totalParcels: sql<number>`count(*)`.mapWith(Number),
      atOffice: sql<number>`count(*) filter (where ${parcels.status} = 'at_office')`.mapWith(
        Number,
      ),
      onTheWay: sql<number>`count(*) filter (where ${parcels.status} = 'on_the_way')`.mapWith(
        Number,
      ),
      delivered: sql<number>`count(*) filter (where ${parcels.status} = 'delivered')`.mapWith(
        Number,
      ),
      expectedCollection: sql<number>`coalesce(sum(
        case
          when ${parcels.riderId} is not null and ${parcels.status} in ('at_office', 'on_the_way') then
            case when ${parcels.parcelType} = 'cod' then ${parcels.codAmount} + ${parcels.deliveryFee} else ${parcels.deliveryFee} end
          else 0
        end
      ), 0)`.mapWith(Number),
    })
    .from(parcels)
    .where(isNull(parcels.deletedAt));

  return {
    totalParcels: summaryRow?.totalParcels ?? 0,
    atOffice: summaryRow?.atOffice ?? 0,
    onTheWay: summaryRow?.onTheWay ?? 0,
    delivered: summaryRow?.delivered ?? 0,
    expectedCollection: summaryRow?.expectedCollection ?? 0,
  };
}

export async function createParcel(input: CreateParcelInputDto & { createdBy: string }) {
  const [merchant] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.id, input.merchantId))
    .limit(1);

  if (!merchant) {
    throw new Error("Merchant was not found.");
  }

  const [township] = await db
    .select({ id: townships.id })
    .from(townships)
    .where(and(eq(townships.id, input.townshipId), eq(townships.isActive, true)))
    .limit(1);

  if (!township) {
    throw new Error("Active township was not found.");
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const parcelCode = generateParcelCode();
    const [existingParcel] = await db
      .select({ id: parcels.id })
      .from(parcels)
      .where(eq(parcels.parcelCode, parcelCode))
      .limit(1);

    if (existingParcel) {
      continue;
    }

    const [createdParcel] = await db
      .insert(parcels)
      .values({
        parcelCode,
        merchantId: input.merchantId,
        townshipId: input.townshipId,
        receiverName: input.receiverName,
        receiverPhoneNumber: input.receiverPhoneNumber,
        receiverAddress: input.receiverAddress,
        specialNotes: input.specialNotes,
        parcelType: input.parcelType,
        codAmount: input.codAmount,
        deliveryFee: input.deliveryFee,
        weightKg: String(input.weightKg),
        isLargeParcel: input.isLargeParcel,
        parcelWidthCm: input.parcelWidthCm === undefined ? undefined : String(input.parcelWidthCm),
        parcelHeightCm:
          input.parcelHeightCm === undefined ? undefined : String(input.parcelHeightCm),
        parcelLengthCm:
          input.parcelLengthCm === undefined ? undefined : String(input.parcelLengthCm),
        status: "at_office",
        codStatus: input.parcelType === "cod" ? "pending" : "not_applicable",
        deliveryFeeStatus: "pending",
        isReceivedByOffice: false,
        merchantSettlementStatus: "pending",
        riderPayoutStatus: "pending",
        createdBy: input.createdBy,
      })
      .returning();

    return createdParcel;
  }

  throw new Error("Unable to generate a unique parcel code.");
}

export async function updateParcel(input: UpdateParcelInputDto) {
  await db.transaction(async (tx) => {
    const [existingParcel] = await tx
      .select({
        id: parcels.id,
        status: parcels.status,
        riderId: parcels.riderId,
        assignedAt: parcels.assignedAt,
        deliveryFailureNote: parcels.deliveryFailureNote,
      })
      .from(parcels)
      .where(and(eq(parcels.id, input.id), isNull(parcels.deletedAt)))
      .limit(1);

    if (!existingParcel) {
      throw new Error("Parcel was not found.");
    }

    const [merchant] = await tx
      .select({ id: merchants.id })
      .from(merchants)
      .where(eq(merchants.id, input.merchantId))
      .limit(1);

    if (!merchant) {
      throw new Error("Merchant was not found.");
    }

    const [township] = await tx
      .select({ id: townships.id })
      .from(townships)
      .where(and(eq(townships.id, input.townshipId), eq(townships.isActive, true)))
      .limit(1);

    if (!township) {
      throw new Error("Active township was not found.");
    }

    await tx
      .update(parcels)
      .set({
        merchantId: input.merchantId,
        townshipId: input.townshipId,
        receiverName: input.receiverName,
        receiverPhoneNumber: input.receiverPhoneNumber,
        receiverAddress: input.receiverAddress,
        specialNotes: input.specialNotes ?? null,
        parcelType: input.parcelType,
        codAmount: input.codAmount,
        deliveryFee: input.deliveryFee,
        weightKg: String(input.weightKg),
        isLargeParcel: input.isLargeParcel,
        parcelWidthCm: input.parcelWidthCm === undefined ? null : String(input.parcelWidthCm),
        parcelHeightCm: input.parcelHeightCm === undefined ? null : String(input.parcelHeightCm),
        parcelLengthCm: input.parcelLengthCm === undefined ? null : String(input.parcelLengthCm),
        updatedAt: new Date(),
      })
      .where(eq(parcels.id, input.id));
  });
}

type ParcelCorrectionActor = {
  actorId: string;
  actorRole: UserRole;
};

type CorrectionFinancialItem = {
  id: string;
  riderId: string | null;
  itemType: string;
  riderWaySource: string | null;
  amount: number;
  status: string;
  merchantSettlementId: string | null;
  riderPayoutId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function createFinancialItemsFingerprint(items: CorrectionFinancialItem[]) {
  const normalizedItems = items
    .map((item) => ({
      id: item.id,
      riderId: item.riderId,
      itemType: item.itemType,
      riderWaySource: item.riderWaySource,
      amount: item.amount,
      status: item.status,
      merchantSettlementId: item.merchantSettlementId,
      riderPayoutId: item.riderPayoutId,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))
    .toSorted((left, right) => left.id.localeCompare(right.id));

  return createHash("sha256").update(JSON.stringify(normalizedItems)).digest("hex");
}

function assertFreshCorrectionState(input: {
  expectedStatus: ParcelStatus;
  expectedRiderId: string | null;
  expectedFinancialItemsFingerprint: string;
  currentStatus: ParcelStatus;
  currentRiderId: string | null;
  currentFinancialItems: CorrectionFinancialItem[];
}) {
  const currentFinancialItemsFingerprint = createFinancialItemsFingerprint(
    input.currentFinancialItems,
  );

  if (
    input.currentStatus !== input.expectedStatus ||
    input.currentRiderId !== input.expectedRiderId ||
    currentFinancialItemsFingerprint !== input.expectedFinancialItemsFingerprint
  ) {
    throw new Error("Parcel changed since you opened it. Refresh and review before correcting.");
  }
}

function assertCanCorrectParcel(actorRole: UserRole) {
  if (actorRole !== "super_admin" && actorRole !== "office_admin") {
    throw new Error("You do not have permission to correct parcels.");
  }
}

function getActiveFinancialItemTypes(items: CorrectionFinancialItem[]) {
  const activeItemTypes = new Set<FinancialItemType>();

  for (const item of items) {
    if (item.status !== "void" && isFinancialItemType(item.itemType)) {
      activeItemTypes.add(item.itemType);
    }
  }

  return activeItemTypes;
}

function shouldPreserveFinancialItemForStatus(
  item: CorrectionFinancialItem,
  targetStatus: ParcelStatus,
) {
  if (item.itemType === "rider_way_payout") {
    if (item.riderWaySource === "merchant_return") {
      return targetStatus === "returned_to_merchant";
    }

    return true;
  }

  return item.itemType === "delivery_fee_deduction" && targetStatus === "returned_to_merchant";
}

function getCorrectionFinancialItemsToVoid(
  items: CorrectionFinancialItem[],
  targetStatus: ParcelStatus,
) {
  const inconsistentItems = items.filter(
    (item) =>
      item.status !== "void" &&
      isFinancialItemType(item.itemType) &&
      !shouldPreserveFinancialItemForStatus(item, targetStatus),
  );
  const unsafeItem = inconsistentItems.find(
    (item) =>
      item.status !== "pending" ||
      item.merchantSettlementId !== null ||
      item.riderPayoutId !== null,
  );

  if (unsafeItem) {
    throw new Error(
      "This parcel has financial items already reserved or settled. Reverse those records before correcting the parcel.",
    );
  }

  return inconsistentItems.map((item) => item.id);
}

function hasActiveRiderWaySource(items: CorrectionFinancialItem[], sources: RiderWaySource[]) {
  const sourceSet = new Set<RiderWaySource>(sources);

  return items.some((item) => {
    let riderWaySource: RiderWaySource | null = null;

    if (item.riderWaySource === null) {
      riderWaySource = "legacy_delivery";
    } else if (isRiderWaySource(item.riderWaySource)) {
      riderWaySource = item.riderWaySource;
    }

    return (
      item.itemType === "rider_way_payout" &&
      item.status !== "void" &&
      riderWaySource !== null &&
      sourceSet.has(riderWaySource)
    );
  });
}

function getLatestActiveDeliveryAttemptItem(items: CorrectionFinancialItem[]) {
  return items
    .filter(
      (item) =>
        item.itemType === "rider_way_payout" &&
        isDeliveryAttemptRiderWaySource(item.riderWaySource) &&
        item.status !== "void",
    )
    .toSorted((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
}

function assertDeliveryAttemptOwnershipCanChange(item: CorrectionFinancialItem) {
  if (item.status !== "pending" || item.riderPayoutId !== null) {
    throw new Error(
      "The current delivery attempt is already reserved or settled. Reverse that payout before correcting the rider.",
    );
  }
}

function deactivateActiveFailureNoteIfNeeded(
  deliveryFailureNote: unknown,
): typeof parcels.$inferInsert.deliveryFailureNote {
  const failureNotes = parseParcelFailureNotes(deliveryFailureNote);
  const nextFailureNotes = deactivateLatestActiveParcelFailureNote(failureNotes);

  return nextFailureNotes ?? (failureNotes.length > 0 ? failureNotes : null);
}

function getResetCodStatus(parcelType: string) {
  return parcelType === "cod" ? "pending" : "not_applicable";
}

async function getActiveCorrectionRider(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  riderId: string,
) {
  const [rider] = await tx
    .select({ id: riders.id, userIsActive: appUsers.isActive })
    .from(riders)
    .innerJoin(appUsers, eq(appUsers.id, riders.userId))
    .where(eq(riders.id, riderId))
    .limit(1);

  if (!rider?.userIsActive) {
    throw new Error("Active rider was not found.");
  }

  return rider;
}

export async function correctParcelStatus(
  input: CorrectParcelStatusInputDto & ParcelCorrectionActor,
) {
  assertCanCorrectParcel(input.actorRole);

  await db.transaction(async (tx) => {
    const [parcel] = await tx
      .select({
        id: parcels.id,
        merchantId: parcels.merchantId,
        riderId: parcels.riderId,
        status: parcels.status,
        parcelType: parcels.parcelType,
        codAmount: parcels.codAmount,
        deliveryFee: parcels.deliveryFee,
        assignedAt: parcels.assignedAt,
        deliveryFailureNote: parcels.deliveryFailureNote,
        proofOfDeliveryImagesKeys: parcels.proofOfDeliveryImagesKeys,
      })
      .from(parcels)
      .where(and(eq(parcels.id, input.parcelId), isNull(parcels.deletedAt)))
      .limit(1)
      .for("update");

    if (!parcel) {
      throw new Error("Parcel was not found.");
    }

    const oldStatus = parcelStatusSchema.parse(parcel.status);

    const relatedFinancialItems = await tx
      .select({
        id: financialItems.id,
        riderId: financialItems.riderId,
        itemType: financialItems.itemType,
        riderWaySource: financialItems.riderWaySource,
        amount: financialItems.amount,
        status: financialItems.status,
        merchantSettlementId: financialItems.merchantSettlementId,
        riderPayoutId: financialItems.riderPayoutId,
        createdAt: financialItems.createdAt,
        updatedAt: financialItems.updatedAt,
      })
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcel.id))
      .for("update");

    assertFreshCorrectionState({
      expectedStatus: input.expectedStatus,
      expectedRiderId: input.expectedRiderId,
      expectedFinancialItemsFingerprint: input.expectedFinancialItemsFingerprint,
      currentStatus: oldStatus,
      currentRiderId: parcel.riderId,
      currentFinancialItems: relatedFinancialItems,
    });

    if (oldStatus === input.targetStatus) {
      throw new Error("Target status is already the current parcel status.");
    }

    const now = new Date();
    const activeItemTypes = getActiveFinancialItemTypes(relatedFinancialItems);
    const sideEffects: string[] = [];
    const proofKeys = input.proofImageKey
      ? [input.proofImageKey]
      : (parcel.proofOfDeliveryImagesKeys ?? []);
    const baseParcelUpdate = {
      status: input.targetStatus,
      updatedAt: now,
      merchantSettlementStatus: "pending",
      riderPayoutStatus: "pending",
    };
    const commonResetFields = {
      deliveredAt: null,
      returnedToMerchantAt: null,
      collectedAt: null,
      collectedAmount: 0,
      codStatus: getResetCodStatus(parcel.parcelType),
      deliveryFeeStatus: "pending",
      isReceivedByOffice: false,
      collectionConfirmedBy: null,
      proofOfDeliveryImagesKeys: [],
      deliveryFailureNote: deactivateActiveFailureNoteIfNeeded(parcel.deliveryFailureNote),
    };
    let targetRiderId: string | null = null;
    let currentDeliveryAttemptItem: CorrectionFinancialItem | undefined;
    let parcelUpdate: Partial<typeof parcels.$inferInsert> = {};

    if (input.targetStatus === "delivered") {
      targetRiderId = input.targetRiderId ?? parcel.riderId;

      if (!targetRiderId) {
        throw new Error("An active rider is required when correcting a parcel to delivered.");
      }

      await getActiveCorrectionRider(tx, targetRiderId);

      if (proofKeys.length === 0) {
        throw new Error("Delivery proof is required when correcting a parcel to delivered.");
      }

      currentDeliveryAttemptItem = getLatestActiveDeliveryAttemptItem(relatedFinancialItems);

      if (!currentDeliveryAttemptItem) {
        throw new Error(
          "Correcting to delivered requires an existing delivery attempt. Use the normal start-delivery workflow first.",
        );
      }

      if (currentDeliveryAttemptItem.riderId !== targetRiderId) {
        assertDeliveryAttemptOwnershipCanChange(currentDeliveryAttemptItem);
      }

      parcelUpdate = {
        ...baseParcelUpdate,
        riderId: targetRiderId,
        assignedAt: parcel.riderId === targetRiderId && parcel.assignedAt ? parcel.assignedAt : now,
        deliveredAt: now,
        returnedToMerchantAt: null,
        collectedAt: now,
        collectedAmount: calculateAmountToCollect(parcel),
        codStatus: parcel.parcelType === "cod" ? "collected" : "not_applicable",
        deliveryFeeStatus: "collected",
        isReceivedByOffice: false,
        collectionConfirmedBy: null,
        proofOfDeliveryImagesKeys: proofKeys,
        deliveryFailureNote: deactivateActiveFailureNoteIfNeeded(parcel.deliveryFailureNote),
      };
      sideEffects.push("Set delivery completion and collection fields.");
    } else if (input.targetStatus === "returned_to_merchant") {
      targetRiderId = input.targetRiderId ?? parcel.riderId;
      let targetAssignedAt: Date | null = null;

      if (targetRiderId) {
        await getActiveCorrectionRider(tx, targetRiderId);
        targetAssignedAt =
          parcel.riderId === targetRiderId && parcel.assignedAt ? parcel.assignedAt : now;
      }

      parcelUpdate = {
        ...baseParcelUpdate,
        ...commonResetFields,
        riderId: targetRiderId,
        assignedAt: targetAssignedAt,
        returnedToMerchantAt: now,
        deliveryFeeStatus: "deduct_from_merchant",
      };
      sideEffects.push("Set return completion fields.");
    } else if (input.targetStatus === "on_the_way") {
      targetRiderId = input.targetRiderId ?? parcel.riderId;

      if (!targetRiderId) {
        throw new Error("An active rider is required when correcting a parcel to on the way.");
      }

      await getActiveCorrectionRider(tx, targetRiderId);
      parcelUpdate = {
        ...baseParcelUpdate,
        ...commonResetFields,
        riderId: targetRiderId,
        assignedAt: parcel.riderId === targetRiderId && parcel.assignedAt ? parcel.assignedAt : now,
      };
      sideEffects.push("Reset later delivery and return fields.");
    } else if (input.targetStatus === "canceled_returned") {
      targetRiderId = input.targetRiderId ?? null;

      if (targetRiderId) {
        await getActiveCorrectionRider(tx, targetRiderId);
      }

      parcelUpdate = {
        ...baseParcelUpdate,
        ...commonResetFields,
        riderId: targetRiderId,
        assignedAt: targetRiderId ? now : null,
      };
      sideEffects.push("Prepared parcel for merchant return handling.");
    } else {
      parcelUpdate = {
        ...baseParcelUpdate,
        ...commonResetFields,
        riderId: null,
        assignedAt: null,
      };
      sideEffects.push(
        input.targetStatus === "postpone"
          ? "Postponed parcel and cleared rider assignment."
          : "Reset parcel to office state and cleared rider assignment.",
      );
    }

    const voidableFinancialItemIds = getCorrectionFinancialItemsToVoid(
      relatedFinancialItems,
      input.targetStatus,
    );

    if (voidableFinancialItemIds.length > 0) {
      await tx
        .update(financialItems)
        .set({ status: "void", updatedAt: now })
        .where(inArray(financialItems.id, voidableFinancialItemIds));
      sideEffects.push(`Voided ${voidableFinancialItemIds.length} pending financial item(s).`);
    }

    if (
      input.targetStatus === "delivered" &&
      targetRiderId &&
      currentDeliveryAttemptItem &&
      currentDeliveryAttemptItem.riderId !== targetRiderId
    ) {
      await tx
        .update(financialItems)
        .set({ riderId: targetRiderId, updatedAt: now })
        .where(eq(financialItems.id, currentDeliveryAttemptItem.id));
      sideEffects.push("Corrected the latest delivery-attempt payout item rider.");
    }

    if (input.targetStatus === "returned_to_merchant") {
      if (!activeItemTypes.has("delivery_fee_deduction")) {
        await tx.insert(financialItems).values({
          parcelId: parcel.id,
          merchantId: parcel.merchantId,
          riderId: null,
          itemType: "delivery_fee_deduction",
          amount: parcel.deliveryFee,
          status: "pending",
          createdBy: input.actorId,
          updatedAt: now,
        });
        sideEffects.push("Created pending delivery fee deduction item.");
      }

      if (targetRiderId && !hasActiveRiderWaySource(relatedFinancialItems, ["merchant_return"])) {
        await tx.insert(financialItems).values({
          parcelId: parcel.id,
          merchantId: parcel.merchantId,
          riderId: targetRiderId,
          itemType: "rider_way_payout",
          riderWaySource: "merchant_return",
          amount: 1,
          status: "pending",
          createdBy: input.actorId,
          updatedAt: now,
        });
        sideEffects.push("Created pending merchant-return rider payout item.");
      }
    }

    await tx.update(parcels).set(parcelUpdate).where(eq(parcels.id, parcel.id));
    await recomputeParcelRiderPayoutStatuses(tx, [parcel.id]);

    const [statusLog] = await tx
      .insert(parcelStatusLogs)
      .values({
        parcelId: parcel.id,
        oldStatus,
        newStatus: input.targetStatus,
        changedBy: input.actorId,
      })
      .returning({ id: parcelStatusLogs.id });

    await tx.insert(parcelCorrectionLogs).values({
      parcelId: parcel.id,
      correctionType: "status",
      oldStatus,
      newStatus: input.targetStatus,
      oldRiderId: parcel.riderId,
      newRiderId: targetRiderId,
      statusLogId: statusLog.id,
      reason: input.reason,
      sideEffects: { summary: sideEffects },
      createdBy: input.actorId,
    });
  });
}

export async function correctParcelRider(
  input: CorrectParcelRiderInputDto & ParcelCorrectionActor,
) {
  assertCanCorrectParcel(input.actorRole);

  await db.transaction(async (tx) => {
    const [parcel] = await tx
      .select({
        id: parcels.id,
        riderId: parcels.riderId,
        status: parcels.status,
      })
      .from(parcels)
      .where(and(eq(parcels.id, input.parcelId), isNull(parcels.deletedAt)))
      .limit(1)
      .for("update");

    if (!parcel) {
      throw new Error("Parcel was not found.");
    }

    const status = parcelStatusSchema.parse(parcel.status);

    const relatedRiderPayoutItems = await tx
      .select({
        id: financialItems.id,
        riderId: financialItems.riderId,
        itemType: financialItems.itemType,
        riderWaySource: financialItems.riderWaySource,
        amount: financialItems.amount,
        status: financialItems.status,
        merchantSettlementId: financialItems.merchantSettlementId,
        riderPayoutId: financialItems.riderPayoutId,
        createdAt: financialItems.createdAt,
        updatedAt: financialItems.updatedAt,
      })
      .from(financialItems)
      .where(eq(financialItems.parcelId, parcel.id))
      .for("update");

    assertFreshCorrectionState({
      expectedStatus: input.expectedStatus,
      expectedRiderId: input.expectedRiderId,
      expectedFinancialItemsFingerprint: input.expectedFinancialItemsFingerprint,
      currentStatus: status,
      currentRiderId: parcel.riderId,
      currentFinancialItems: relatedRiderPayoutItems,
    });

    if (parcel.riderId === input.targetRiderId) {
      throw new Error("Target rider is already assigned to this parcel.");
    }

    if (input.targetRiderId === null) {
      const canUnassign =
        status === "at_office" || status === "postpone" || status === "canceled_returned";

      if (!canUnassign) {
        throw new Error("This parcel status requires an active rider assignment.");
      }
    } else {
      await getActiveCorrectionRider(tx, input.targetRiderId);
    }

    const currentAttemptItem =
      status === "on_the_way" || status === "delivered"
        ? getLatestActiveDeliveryAttemptItem(relatedRiderPayoutItems)
        : undefined;

    if (
      currentAttemptItem &&
      input.targetRiderId !== null &&
      currentAttemptItem.riderId !== input.targetRiderId
    ) {
      assertDeliveryAttemptOwnershipCanChange(currentAttemptItem);
    }

    const now = new Date();
    const sideEffects: string[] = ["Updated parcel rider assignment."];

    await tx
      .update(parcels)
      .set({
        riderId: input.targetRiderId,
        assignedAt: input.targetRiderId ? now : null,
        updatedAt: now,
      })
      .where(eq(parcels.id, parcel.id));

    if (
      currentAttemptItem &&
      input.targetRiderId !== null &&
      currentAttemptItem.riderId !== input.targetRiderId
    ) {
      await tx
        .update(financialItems)
        .set({ riderId: input.targetRiderId, updatedAt: now })
        .where(eq(financialItems.id, currentAttemptItem.id));
      sideEffects.push("Updated the current delivery-attempt payout item rider.");
    }

    await tx.insert(parcelCorrectionLogs).values({
      parcelId: parcel.id,
      correctionType: "rider",
      oldStatus: status,
      newStatus: status,
      oldRiderId: parcel.riderId,
      newRiderId: input.targetRiderId,
      reason: input.reason,
      sideEffects: { summary: sideEffects },
      createdBy: input.actorId,
    });
  });
}

export async function assignParcelsToRider(input: {
  parcelIds: string[];
  riderId: string;
  actorId?: string;
}) {
  await db.transaction(async (tx) => {
    const [rider] = await tx
      .select({ id: riders.id, userIsActive: appUsers.isActive })
      .from(riders)
      .innerJoin(appUsers, eq(appUsers.id, riders.userId))
      .where(eq(riders.id, input.riderId))
      .limit(1);

    if (!rider?.userIsActive) {
      throw new Error("Active rider was not found.");
    }

    const selectedParcels = await tx
      .select({ id: parcels.id, riderId: parcels.riderId, status: parcels.status })
      .from(parcels)
      .where(and(inArray(parcels.id, input.parcelIds), isNull(parcels.deletedAt)));

    if (selectedParcels.length !== input.parcelIds.length) {
      throw new Error("One or more selected parcels were not found.");
    }

    const ineligibleParcel = selectedParcels.find(
      (parcel) =>
        parcel.riderId !== null ||
        !assignmentEligibleStatuses.some((status) => status === parcel.status),
    );

    if (ineligibleParcel) {
      throw new Error("Only unassigned at-office, postponed, or returned parcels can be assigned.");
    }

    const assignedAt = new Date();
    const postponedParcelIds = selectedParcels
      .filter((parcel) => parcel.status === "postpone")
      .map((parcel) => parcel.id);
    const nonPostponedParcelIds = selectedParcels
      .filter((parcel) => parcel.status !== "postpone")
      .map((parcel) => parcel.id);

    if (nonPostponedParcelIds.length > 0) {
      await tx
        .update(parcels)
        .set({
          riderId: input.riderId,
          assignedAt,
          updatedAt: assignedAt,
        })
        .where(inArray(parcels.id, nonPostponedParcelIds));
    }

    if (postponedParcelIds.length > 0) {
      await tx
        .update(parcels)
        .set({
          riderId: input.riderId,
          assignedAt,
          status: "at_office",
          updatedAt: assignedAt,
        })
        .where(inArray(parcels.id, postponedParcelIds));

      await tx.insert(parcelStatusLogs).values(
        postponedParcelIds.map((parcelId) => ({
          parcelId,
          oldStatus: "postpone",
          newStatus: "at_office",
          changedBy: input.actorId,
        })),
      );
    }
  });
}

export async function resolveFailedParcelByAdmin(input: {
  parcelId: string;
  targetStatus: Extract<ParcelStatus, "postpone" | "canceled_returned">;
  actorId: string;
  actorRole: UserRole;
}) {
  if (!canChangeParcelStatus(input.actorRole, "on_the_way", input.targetStatus)) {
    throw new Error("You do not have permission to resolve failed parcels.");
  }

  await db.transaction(async (tx) => {
    const [parcel] = await tx
      .select({
        id: parcels.id,
        status: parcels.status,
        riderId: parcels.riderId,
        deliveryFailureNote: parcels.deliveryFailureNote,
      })
      .from(parcels)
      .where(and(eq(parcels.id, input.parcelId), isNull(parcels.deletedAt)))
      .limit(1)
      .for("update");

    if (!parcel) {
      throw new Error("Parcel was not found.");
    }

    if (parcel.status !== "on_the_way") {
      throw new Error("Only on-the-way failed parcels can be resolved.");
    }

    if (parcel.riderId === null) {
      throw new Error("This failure report has already been handled.");
    }

    const currentFailureNotes = parseParcelFailureNotes(parcel.deliveryFailureNote);
    const nextFailureNotes = deactivateLatestActiveParcelFailureNote(currentFailureNotes);

    if (!nextFailureNotes) {
      throw new Error("Failure note is required before resolving a failed parcel.");
    }

    const resolvedAt = new Date();

    const [resolvedParcel] = await tx
      .update(parcels)
      .set({
        deliveryFailureNote: nextFailureNotes,
        status: input.targetStatus,
        riderId: null,
        assignedAt: null,
        updatedAt: resolvedAt,
      })
      .where(and(eq(parcels.id, input.parcelId), eq(parcels.riderId, parcel.riderId)))
      .returning({ id: parcels.id });

    if (!resolvedParcel) {
      throw new Error("This failure report has already been handled.");
    }

    await tx.insert(parcelStatusLogs).values({
      parcelId: parcel.id,
      oldStatus: "on_the_way",
      newStatus: input.targetStatus,
      changedBy: input.actorId,
    });
    await recomputeParcelRiderPayoutStatuses(tx, [parcel.id]);
  });
}

export async function startDeliveryForRiderParcels(input: {
  parcelIds: string[];
  riderUserId: string;
  actorRole: "rider";
}) {
  if (!canChangeParcelStatus(input.actorRole, "at_office", "on_the_way")) {
    throw new ParcelOperationError("forbidden", "You do not have permission to start delivery.");
  }

  const uniqueParcelIds = Array.from(new Set(input.parcelIds));

  await db.transaction(async (tx) => {
    const [rider] = await tx
      .select({ id: riders.id, userIsActive: appUsers.isActive })
      .from(riders)
      .innerJoin(appUsers, eq(appUsers.id, riders.userId))
      .where(eq(riders.userId, input.riderUserId))
      .limit(1);

    if (!rider?.userIsActive) {
      throw new ParcelOperationError("forbidden", "Active rider profile was not found.");
    }

    const selectedParcels = await tx
      .select({
        id: parcels.id,
        merchantId: parcels.merchantId,
        status: parcels.status,
        riderId: parcels.riderId,
        deliveryFailureNote: parcels.deliveryFailureNote,
      })
      .from(parcels)
      .where(and(inArray(parcels.id, uniqueParcelIds), isNull(parcels.deletedAt)))
      .for("update");

    if (selectedParcels.length !== uniqueParcelIds.length) {
      throw new ParcelOperationError("not_found", "One or more selected parcels were not found.");
    }

    const unrelatedParcel = selectedParcels.find((parcel) => parcel.riderId !== rider.id);

    if (unrelatedParcel) {
      throw new ParcelOperationError(
        "not_assigned",
        "You can only start delivery for parcels assigned to your rider account.",
      );
    }

    const ineligibleParcel = selectedParcels.find((parcel) => parcel.status !== "at_office");

    if (ineligibleParcel) {
      throw new ParcelOperationError(
        "conflict",
        "Only assigned at-office parcels can be started for delivery.",
      );
    }

    const startedAt = new Date();
    const updatedParcels = await tx
      .update(parcels)
      .set({
        status: "on_the_way",
        updatedAt: startedAt,
      })
      .where(
        and(
          inArray(parcels.id, uniqueParcelIds),
          eq(parcels.riderId, rider.id),
          eq(parcels.status, "at_office"),
        ),
      )
      .returning({ id: parcels.id });

    if (updatedParcels.length !== uniqueParcelIds.length) {
      throw new ParcelOperationError(
        "conflict",
        "One or more selected parcels are no longer eligible to start delivery.",
      );
    }

    await tx.insert(financialItems).values(
      selectedParcels.map((parcel) => ({
        parcelId: parcel.id,
        merchantId: parcel.merchantId,
        riderId: rider.id,
        itemType: "rider_way_payout" as const,
        riderWaySource: "delivery_attempt" as const,
        amount: 1,
        status: "pending" as const,
        createdBy: input.riderUserId,
        updatedAt: startedAt,
      })),
    );
    await tx.insert(parcelStatusLogs).values(
      selectedParcels.map((parcel) => ({
        parcelId: parcel.id,
        oldStatus: "at_office",
        newStatus: "on_the_way",
        changedBy: input.riderUserId,
      })),
    );
    await recomputeParcelRiderPayoutStatuses(tx, uniqueParcelIds);
  });
}

export async function reportDeliveryFailureForRiderParcel(input: {
  parcelId: string;
  note: string;
  riderUserId: string;
  actorRole: "rider";
}) {
  if (input.actorRole !== "rider") {
    throw new Error("You do not have permission to report delivery failure.");
  }

  await db.transaction(async (tx) => {
    const [rider] = await tx
      .select({ id: riders.id, userIsActive: appUsers.isActive })
      .from(riders)
      .innerJoin(appUsers, eq(appUsers.id, riders.userId))
      .where(eq(riders.userId, input.riderUserId))
      .limit(1);

    if (!rider?.userIsActive) {
      throw new Error("Active rider profile was not found.");
    }

    const [parcel] = await tx
      .select({
        id: parcels.id,
        status: parcels.status,
        riderId: parcels.riderId,
        deliveryFailureNote: parcels.deliveryFailureNote,
      })
      .from(parcels)
      .where(and(eq(parcels.id, input.parcelId), isNull(parcels.deletedAt)))
      .limit(1)
      .for("update");

    if (!parcel) {
      throw new Error("Parcel was not found.");
    }

    if (parcel.riderId !== rider.id) {
      throw new Error("You can only report failure for parcels assigned to your rider account.");
    }

    if (parcel.status !== "on_the_way") {
      throw new Error("Only on-the-way parcels can be reported as failed.");
    }

    const currentFailureNotes = parseParcelFailureNotes(parcel.deliveryFailureNote);

    if (getActiveParcelFailureNote(currentFailureNotes)) {
      throw new Error("This parcel already has an active failure note.");
    }

    await tx
      .update(parcels)
      .set({
        deliveryFailureNote: appendActiveParcelFailureNote(currentFailureNotes, input.note),
        updatedAt: new Date(),
      })
      .where(and(eq(parcels.id, input.parcelId), eq(parcels.riderId, rider.id)));
  });
}

export async function updateDeliveryFailureForRiderParcel(input: {
  parcelId: string;
  note: string;
  riderUserId: string;
  actorRole: "rider";
}) {
  if (input.actorRole !== "rider") {
    throw new Error("You do not have permission to update delivery failure notes.");
  }

  await db.transaction(async (tx) => {
    const [rider] = await tx
      .select({ id: riders.id, userIsActive: appUsers.isActive })
      .from(riders)
      .innerJoin(appUsers, eq(appUsers.id, riders.userId))
      .where(eq(riders.userId, input.riderUserId))
      .limit(1);

    if (!rider?.userIsActive) {
      throw new Error("Active rider profile was not found.");
    }

    const [parcel] = await tx
      .select({
        id: parcels.id,
        status: parcels.status,
        riderId: parcels.riderId,
        deliveryFailureNote: parcels.deliveryFailureNote,
      })
      .from(parcels)
      .where(and(eq(parcels.id, input.parcelId), isNull(parcels.deletedAt)))
      .limit(1)
      .for("update");

    if (!parcel) {
      throw new Error("Parcel was not found.");
    }

    if (parcel.riderId !== rider.id) {
      throw new Error(
        "You can only update failure notes for parcels assigned to your rider account.",
      );
    }

    if (parcel.status !== "on_the_way") {
      throw new Error("Only on-the-way parcel failure notes can be updated.");
    }

    const currentFailureNotes = parseParcelFailureNotes(parcel.deliveryFailureNote);
    const nextFailureNotes = updateLatestActiveParcelFailureNote(currentFailureNotes, input.note);

    if (!nextFailureNotes) {
      throw new Error("No active failure note was found for this parcel.");
    }

    await tx
      .update(parcels)
      .set({
        deliveryFailureNote: nextFailureNotes,
        updatedAt: new Date(),
      })
      .where(and(eq(parcels.id, input.parcelId), eq(parcels.riderId, rider.id)));
  });
}

export async function deleteDeliveryFailureForRiderParcel(input: {
  parcelId: string;
  riderUserId: string;
  actorRole: "rider";
}) {
  if (input.actorRole !== "rider") {
    throw new Error("You do not have permission to delete delivery failure notes.");
  }

  await db.transaction(async (tx) => {
    const [rider] = await tx
      .select({ id: riders.id, userIsActive: appUsers.isActive })
      .from(riders)
      .innerJoin(appUsers, eq(appUsers.id, riders.userId))
      .where(eq(riders.userId, input.riderUserId))
      .limit(1);

    if (!rider?.userIsActive) {
      throw new Error("Active rider profile was not found.");
    }

    const [parcel] = await tx
      .select({
        id: parcels.id,
        status: parcels.status,
        riderId: parcels.riderId,
        deliveryFailureNote: parcels.deliveryFailureNote,
      })
      .from(parcels)
      .where(and(eq(parcels.id, input.parcelId), isNull(parcels.deletedAt)))
      .limit(1);

    if (!parcel) {
      throw new Error("Parcel was not found.");
    }

    if (parcel.riderId !== rider.id) {
      throw new Error(
        "You can only delete failure notes for parcels assigned to your rider account.",
      );
    }

    if (parcel.status !== "on_the_way") {
      throw new Error("Only on-the-way parcel failure notes can be deleted.");
    }

    const currentFailureNotes = parseParcelFailureNotes(parcel.deliveryFailureNote);
    const nextFailureNotes = removeLatestActiveParcelFailureNote(currentFailureNotes);

    if (!nextFailureNotes) {
      throw new Error("No active failure note was found for this parcel.");
    }

    await tx
      .update(parcels)
      .set({
        deliveryFailureNote: nextFailureNotes.length > 0 ? nextFailureNotes : null,
        updatedAt: new Date(),
      })
      .where(and(eq(parcels.id, input.parcelId), eq(parcels.riderId, rider.id)));
  });
}

export async function markRiderParcelDelivered(input: {
  parcelId: string;
  proofImageKey: string;
  riderUserId: string;
  actorRole: "rider";
  createdBy: string;
}) {
  if (!canChangeParcelStatus(input.actorRole, "on_the_way", "delivered")) {
    throw new ParcelOperationError(
      "forbidden",
      "You do not have permission to mark parcels delivered.",
    );
  }

  await db.transaction(async (tx) => {
    const [rider] = await tx
      .select({ id: riders.id, userIsActive: appUsers.isActive })
      .from(riders)
      .innerJoin(appUsers, eq(appUsers.id, riders.userId))
      .where(eq(riders.userId, input.riderUserId))
      .limit(1);

    if (!rider?.userIsActive) {
      throw new ParcelOperationError("forbidden", "Active rider profile was not found.");
    }

    const [parcel] = await tx
      .select({
        id: parcels.id,
        merchantId: parcels.merchantId,
        riderId: parcels.riderId,
        status: parcels.status,
        parcelType: parcels.parcelType,
        codAmount: parcels.codAmount,
        deliveryFee: parcels.deliveryFee,
        deliveryFailureNote: parcels.deliveryFailureNote,
      })
      .from(parcels)
      .where(and(eq(parcels.id, input.parcelId), isNull(parcels.deletedAt)))
      .limit(1)
      .for("update");

    if (!parcel) {
      throw new ParcelOperationError("not_found", "Parcel was not found.");
    }

    if (parcel.riderId !== rider.id) {
      throw new ParcelOperationError(
        "not_assigned",
        "You can only mark parcels assigned to your rider account delivered.",
      );
    }

    if (parcel.status !== "on_the_way") {
      throw new ParcelOperationError(
        "conflict",
        "Only on-the-way parcels can be marked delivered.",
      );
    }

    if (getActiveParcelFailureNote(parseParcelFailureNotes(parcel.deliveryFailureNote))) {
      throw new ParcelOperationError(
        "conflict",
        "Resolve the delivery failure note before marking this parcel delivered.",
      );
    }

    const deliveredAt = new Date();
    const isCodParcel = parcel.parcelType === "cod";
    const collectedAmount = (isCodParcel ? parcel.codAmount : 0) + parcel.deliveryFee;

    const [deliveredParcel] = await tx
      .update(parcels)
      .set({
        status: "delivered",
        deliveredAt,
        collectedAt: deliveredAt,
        collectedAmount,
        codStatus: isCodParcel ? "collected" : "not_applicable",
        deliveryFeeStatus: "collected",
        isReceivedByOffice: false,
        merchantSettlementStatus: "pending",
        riderPayoutStatus: "pending",
        proofOfDeliveryImagesKeys: [input.proofImageKey],
        updatedAt: deliveredAt,
      })
      .where(
        and(
          eq(parcels.id, input.parcelId),
          eq(parcels.riderId, rider.id),
          eq(parcels.status, "on_the_way"),
        ),
      )
      .returning({ id: parcels.id });

    if (!deliveredParcel) {
      throw new ParcelOperationError(
        "conflict",
        "Only on-the-way parcels can be marked delivered.",
      );
    }

    await tx.insert(parcelStatusLogs).values({
      parcelId: parcel.id,
      oldStatus: "on_the_way",
      newStatus: "delivered",
      changedBy: input.createdBy,
    });
    await recomputeParcelRiderPayoutStatuses(tx, [parcel.id]);
  });
}

export async function markRiderParcelReturnedToMerchant(input: {
  parcelId: string;
  riderUserId: string;
  actorRole: "rider";
  createdBy: string;
}) {
  if (!canChangeParcelStatus(input.actorRole, "canceled_returned", "returned_to_merchant")) {
    throw new Error("You do not have permission to complete parcel returns.");
  }

  await db.transaction(async (tx) => {
    const [rider] = await tx
      .select({ id: riders.id, userIsActive: appUsers.isActive })
      .from(riders)
      .innerJoin(appUsers, eq(appUsers.id, riders.userId))
      .where(eq(riders.userId, input.riderUserId))
      .limit(1);

    if (!rider?.userIsActive) {
      throw new Error("Active rider profile was not found.");
    }

    const [parcel] = await tx
      .select({
        id: parcels.id,
        merchantId: parcels.merchantId,
        riderId: parcels.riderId,
        status: parcels.status,
        deliveryFee: parcels.deliveryFee,
      })
      .from(parcels)
      .where(and(eq(parcels.id, input.parcelId), isNull(parcels.deletedAt)))
      .limit(1)
      .for("update");

    if (!parcel) {
      throw new Error("Parcel was not found.");
    }

    if (parcel.riderId !== rider.id) {
      throw new Error(
        "You can only complete merchant returns for parcels assigned to your rider account.",
      );
    }

    if (parcel.status !== "canceled_returned") {
      throw new Error("Only canceled-returned parcels can be completed as returned.");
    }

    const returnedAt = new Date();

    const [returnedParcel] = await tx
      .update(parcels)
      .set({
        status: "returned_to_merchant",
        returnedToMerchantAt: returnedAt,
        deliveryFeeStatus: "deduct_from_merchant",
        merchantSettlementStatus: "pending",
        riderPayoutStatus: "pending",
        updatedAt: returnedAt,
      })
      .where(
        and(
          eq(parcels.id, input.parcelId),
          eq(parcels.riderId, rider.id),
          eq(parcels.status, "canceled_returned"),
        ),
      )
      .returning({ id: parcels.id });

    if (!returnedParcel) {
      throw new Error("Only canceled-returned parcels can be completed as returned.");
    }

    await tx.insert(parcelStatusLogs).values({
      parcelId: parcel.id,
      oldStatus: "canceled_returned",
      newStatus: "returned_to_merchant",
      changedBy: input.createdBy,
    });

    await tx.insert(financialItems).values([
      {
        parcelId: parcel.id,
        merchantId: parcel.merchantId,
        riderId: null,
        itemType: "delivery_fee_deduction",
        riderWaySource: null,
        amount: parcel.deliveryFee,
        status: "pending",
        createdBy: input.createdBy,
      },
      {
        parcelId: parcel.id,
        merchantId: parcel.merchantId,
        riderId: rider.id,
        itemType: "rider_way_payout",
        riderWaySource: "merchant_return",
        amount: 1,
        status: "pending",
        createdBy: input.createdBy,
      },
    ]);
    await recomputeParcelRiderPayoutStatuses(tx, [parcel.id]);
  });
}
