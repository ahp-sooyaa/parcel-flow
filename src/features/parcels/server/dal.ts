import { and, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  appUsers,
  financialItems,
  merchants,
  parcels,
  parcelStatusLogs,
  riders,
  townships,
} from "@/db/schema";
import type {
  CreateParcelInputDto,
  MerchantParcelListFiltersDto,
  MerchantParcelListPageDto,
  ParcelListItemDto,
  ParcelSummaryDto,
  UpdateParcelInputDto,
} from "@/features/parcels/server/dto";
import {
  appendActiveParcelFailureNote,
  deactivateLatestActiveParcelFailureNote,
  getActiveParcelFailureNote,
  parseParcelFailureNotes,
  removeLatestActiveParcelFailureNote,
  updateLatestActiveParcelFailureNote,
} from "@/features/parcels/server/failure-notes";
import {
  calculateAmountToCollect,
  generateParcelCode,
  isActiveCollectionStatus,
} from "@/features/parcels/server/utils";
import { parcelStatuses } from "@/lib/domain";
import type { ParcelStatus, UserRole } from "@/lib/domain";
import { canChangeParcelStatus } from "@/lib/permissions";

const parcelStatusSchema = z.enum(parcelStatuses);
const assignmentEligibleStatuses = ["at_office", "postpone", "canceled_returned"] as const;

function mapParcel(row: {
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
    weightKg: Number(row.weightKg),
    parcelWidthCm: row.parcelWidthCm === null ? null : Number(row.parcelWidthCm),
    parcelHeightCm: row.parcelHeightCm === null ? null : Number(row.parcelHeightCm),
    parcelLengthCm: row.parcelLengthCm === null ? null : Number(row.parcelLengthCm),
    proofOfDeliveryImagesKeys: row.proofOfDeliveryImagesKeys ?? [],
    riderName: row.riderName,
    status: parcelStatusSchema.parse(row.status),
    hasUnresolvedFailureReview:
      row.status === "on_the_way" && row.riderId !== null && activeFailureNote !== null,
    createdAt: row.createdAt.toISOString(),
  };
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
  const hasAnyParcelsWhere = and(isNull(parcels.deletedAt), eq(merchants.userId, userId));
  const filteredWhere = buildMerchantParcelWhere(userId, filters);

  const [hasAnyParcelsRow, totalCountRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(parcels)
      .innerJoin(merchants, eq(merchants.id, parcels.merchantId))
      .where(hasAnyParcelsWhere)
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)` })
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
    parcels: rows.map(mapParcel),
    page,
    pageSize: filters.pageSize,
    totalCount,
    totalPages,
    hasAnyParcels,
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

  return row ? mapParcel(row) : null;
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

  return rows.map(mapParcel);
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

export async function getParcelSummary(): Promise<ParcelSummaryDto> {
  const parcelRows = await db
    .select({
      status: parcels.status,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      parcelType: parcels.parcelType,
      riderId: parcels.riderId,
    })
    .from(parcels)
    .where(isNull(parcels.deletedAt));

  return parcelRows.reduce<ParcelSummaryDto>(
    (summary, parcel) => {
      const status = parcelStatusSchema.parse(parcel.status);

      return {
        totalParcels: summary.totalParcels + 1,
        atOffice: summary.atOffice + (status === "at_office" ? 1 : 0),
        onTheWay: summary.onTheWay + (status === "on_the_way" ? 1 : 0),
        delivered: summary.delivered + (status === "delivered" ? 1 : 0),
        expectedCollection:
          summary.expectedCollection +
          (parcel.riderId !== null && isActiveCollectionStatus(status)
            ? calculateAmountToCollect({
                codAmount: parcel.codAmount,
                deliveryFee: parcel.deliveryFee,
                parcelType: parcel.parcelType,
              })
            : 0),
      };
    },
    {
      totalParcels: 0,
      atOffice: 0,
      onTheWay: 0,
      delivered: 0,
      expectedCollection: 0,
    },
  );
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
      .limit(1);

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
  });
}

export async function startDeliveryForRiderParcels(input: {
  parcelIds: string[];
  riderUserId: string;
  actorRole: "rider";
}) {
  if (!canChangeParcelStatus(input.actorRole, "at_office", "on_the_way")) {
    throw new Error("You do not have permission to start delivery.");
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

    const selectedParcels = await tx
      .select({
        id: parcels.id,
        status: parcels.status,
        riderId: parcels.riderId,
        deliveryFailureNote: parcels.deliveryFailureNote,
      })
      .from(parcels)
      .where(and(inArray(parcels.id, input.parcelIds), isNull(parcels.deletedAt)));

    if (selectedParcels.length !== input.parcelIds.length) {
      throw new Error("One or more selected parcels were not found.");
    }

    const unrelatedParcel = selectedParcels.find((parcel) => parcel.riderId !== rider.id);

    if (unrelatedParcel) {
      throw new Error("You can only start delivery for parcels assigned to your rider account.");
    }

    const ineligibleParcel = selectedParcels.find((parcel) => parcel.status !== "at_office");

    if (ineligibleParcel) {
      throw new Error("Only assigned at-office parcels can be started for delivery.");
    }

    await tx
      .update(parcels)
      .set({
        status: "on_the_way",
        updatedAt: new Date(),
      })
      .where(and(inArray(parcels.id, input.parcelIds), eq(parcels.riderId, rider.id)));
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
      .limit(1);

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
      .limit(1);

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
    throw new Error("You do not have permission to mark parcels delivered.");
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
        parcelType: parcels.parcelType,
        codAmount: parcels.codAmount,
        deliveryFee: parcels.deliveryFee,
      })
      .from(parcels)
      .where(and(eq(parcels.id, input.parcelId), isNull(parcels.deletedAt)))
      .limit(1);

    if (!parcel) {
      throw new Error("Parcel was not found.");
    }

    if (parcel.riderId !== rider.id) {
      throw new Error("You can only mark parcels assigned to your rider account delivered.");
    }

    if (parcel.status !== "on_the_way") {
      throw new Error("Only on-the-way parcels can be marked delivered.");
    }

    const deliveredAt = new Date();
    const isCodParcel = parcel.parcelType === "cod";
    const collectedAmount = (isCodParcel ? parcel.codAmount : 0) + parcel.deliveryFee;

    await tx
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
      .where(and(eq(parcels.id, input.parcelId), eq(parcels.riderId, rider.id)));

    const pendingFinancialItems = [
      {
        parcelId: parcel.id,
        merchantId: parcel.merchantId,
        riderId: rider.id,
        itemType: "rider_way_payout",
        amount: 1,
        status: "pending",
        createdBy: input.createdBy,
      },
    ];

    await tx.insert(financialItems).values(pendingFinancialItems);
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
      .limit(1);

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

    await tx
      .update(parcels)
      .set({
        status: "returned_to_merchant",
        returnedToMerchantAt: returnedAt,
        deliveryFeeStatus: "deduct_from_merchant",
        merchantSettlementStatus: "pending",
        updatedAt: returnedAt,
      })
      .where(and(eq(parcels.id, input.parcelId), eq(parcels.riderId, rider.id)));

    await tx.insert(parcelStatusLogs).values({
      parcelId: parcel.id,
      oldStatus: "canceled_returned",
      newStatus: "returned_to_merchant",
      changedBy: input.createdBy,
    });

    await tx.insert(financialItems).values({
      parcelId: parcel.id,
      merchantId: parcel.merchantId,
      riderId: null,
      itemType: "delivery_fee_deduction",
      amount: parcel.deliveryFee,
      status: "pending",
      createdBy: input.createdBy,
    });
  });
}
