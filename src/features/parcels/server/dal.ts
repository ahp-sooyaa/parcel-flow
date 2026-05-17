import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { appUsers, merchants, parcels, riders, townships } from "@/db/schema";
import type {
  CreateParcelInputDto,
  ParcelListItemDto,
  ParcelSummaryDto,
} from "@/features/parcels/server/dto";
import {
  calculateAmountToCollect,
  generateParcelCode,
  isActiveCollectionStatus,
} from "@/features/parcels/server/utils";
import { parcelStatuses } from "@/lib/domain";

const parcelStatusSchema = z.enum(parcelStatuses);
const assignmentEligibleStatuses = ["at_office", "postpone", "canceled_returned"] as const;

function mapParcel(row: {
  id: string;
  parcelCode: string;
  merchantName: string;
  receiverName: string;
  receiverPhoneNumber: string;
  receiverAddress: string;
  specialNotes: string | null;
  townshipName: string;
  codAmount: number;
  deliveryFee: number;
  riderName: string | null;
  status: string;
  createdAt: Date;
}): ParcelListItemDto {
  return {
    id: row.id,
    parcelCode: row.parcelCode,
    merchantName: row.merchantName,
    receiverName: row.receiverName,
    receiverPhoneNumber: row.receiverPhoneNumber,
    receiverAddress: row.receiverAddress,
    specialNotes: row.specialNotes,
    townshipName: row.townshipName,
    codAmount: row.codAmount,
    deliveryFee: row.deliveryFee,
    riderName: row.riderName,
    status: parcelStatusSchema.parse(row.status),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listParcels(): Promise<ParcelListItemDto[]> {
  return listParcelsByScope({});
}

export async function listParcelsForMerchantUser(userId: string): Promise<ParcelListItemDto[]> {
  return listParcelsByScope({ merchantUserId: userId });
}

export async function listParcelsForRiderUser(userId: string): Promise<ParcelListItemDto[]> {
  return listParcelsByScope({ riderUserId: userId });
}

async function listParcelsByScope(scope: {
  merchantUserId?: string;
  riderUserId?: string;
}): Promise<ParcelListItemDto[]> {
  const rows = await db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantName: merchants.shopName,
      receiverName: parcels.receiverName,
      receiverPhoneNumber: parcels.receiverPhoneNumber,
      receiverAddress: parcels.receiverAddress,
      specialNotes: parcels.specialNotes,
      townshipName: townships.name,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
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

export async function assignParcelsToRider(input: { parcelIds: string[]; riderId: string }) {
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

    await tx
      .update(parcels)
      .set({
        riderId: input.riderId,
        assignedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(inArray(parcels.id, input.parcelIds));
  });
}
