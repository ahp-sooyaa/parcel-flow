import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import {
  type AuditLogInsertInput,
  type CreateParcelInsertInput,
  type CreatePaymentInsertInput,
  type ParcelPaymentUpdatePatch,
  toParcelDetailDto,
  toParcelListItemDto,
  toParcelUpdateContextDto,
  type ParcelUpdatePatch,
  type ParcelDetailDto,
  type ParcelListItemDto,
  type ParcelOptionDto,
  type ParcelUpdateContextDto,
} from "./dto";
import { db } from "@/db";
import {
  appUsers,
  merchants,
  parcelAuditLogs,
  parcelPaymentRecords,
  parcels,
  riders,
  townships,
} from "@/db/schema";
import {
  getParcelAccess,
  getRiderParcelActionAccess,
} from "@/features/auth/server/policies/parcels";
import { toMoneyString } from "@/features/parcels/server/utils";

import type { AppAccessContext } from "@/features/auth/server/dto";

async function listParcels(): Promise<ParcelListItemDto[]> {
  const rows = await db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantId: parcels.merchantId,
      riderId: parcels.riderId,
      merchantLabel: merchants.shopName,
      recipientName: parcels.recipientName,
      recipientTownshipName: townships.name,
      parcelStatus: parcels.status,
      deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
      collectionStatus: parcelPaymentRecords.collectionStatus,
      createdAt: parcels.createdAt,
    })
    .from(parcels)
    .innerJoin(merchants, eq(parcels.merchantId, merchants.appUserId))
    .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
    .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
    .orderBy(desc(parcels.createdAt));

  return rows.map((row) => toParcelListItemDto(row));
}

export async function getParcelsListForViewer(
  viewer: Pick<AppAccessContext, "appUserId" | "roleSlug" | "permissions">,
): Promise<ParcelListItemDto[]> {
  const parcelAccess = getParcelAccess({ viewer });

  if (!parcelAccess.canViewList) {
    return [];
  }

  return listParcels();
}

async function listMerchantParcels(merchantId: string): Promise<ParcelListItemDto[]> {
  const rows = await db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantId: parcels.merchantId,
      riderId: parcels.riderId,
      merchantLabel: merchants.shopName,
      recipientName: parcels.recipientName,
      recipientTownshipName: townships.name,
      parcelStatus: parcels.status,
      deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
      collectionStatus: parcelPaymentRecords.collectionStatus,
      createdAt: parcels.createdAt,
    })
    .from(parcels)
    .innerJoin(merchants, eq(parcels.merchantId, merchants.appUserId))
    .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
    .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
    .where(eq(parcels.merchantId, merchantId))
    .orderBy(desc(parcels.createdAt));

  return rows.map((row) => toParcelListItemDto(row));
}

export async function getMerchantParcelsListForViewer(
  viewer: Pick<AppAccessContext, "appUserId" | "roleSlug" | "permissions">,
  merchantId: string,
): Promise<ParcelListItemDto[]> {
  const parcelAccess = getParcelAccess({
    viewer,
    parcel: {
      merchantId,
    },
  });

  if (!parcelAccess.canView) {
    return [];
  }

  return listMerchantParcels(merchantId);
}

async function listAssignedRiderParcels(riderId: string): Promise<ParcelListItemDto[]> {
  const rows = await db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantId: parcels.merchantId,
      riderId: parcels.riderId,
      merchantLabel: merchants.shopName,
      recipientName: parcels.recipientName,
      recipientTownshipName: townships.name,
      parcelStatus: parcels.status,
      deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
      collectionStatus: parcelPaymentRecords.collectionStatus,
      createdAt: parcels.createdAt,
    })
    .from(parcels)
    .innerJoin(merchants, eq(parcels.merchantId, merchants.appUserId))
    .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
    .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
    .where(eq(parcels.riderId, riderId))
    .orderBy(desc(parcels.createdAt));

  return rows.map((row) => toParcelListItemDto(row));
}

export async function getAssignedRiderParcelsListForViewer(
  viewer: Pick<AppAccessContext, "appUserId" | "roleSlug" | "permissions">,
  riderId: string,
): Promise<ParcelListItemDto[]> {
  const riderParcelActionAccess = getRiderParcelActionAccess({
    viewer,
    parcel: {
      riderId,
    },
  });
  const riderAccess = viewer.permissions.includes("rider.view");

  if (!riderParcelActionAccess.canViewAssignedParcel && !riderAccess) {
    return [];
  }

  return listAssignedRiderParcels(riderId);
}

async function findParcelDetailById(parcelId: string): Promise<ParcelDetailDto | null> {
  const [row] = await db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantId: parcels.merchantId,
      merchantLabel: merchants.shopName,
      riderId: parcels.riderId,
      riderLabel: appUsers.fullName,
      recipientName: parcels.recipientName,
      recipientPhone: parcels.recipientPhone,
      recipientTownshipId: parcels.recipientTownshipId,
      recipientTownshipName: townships.name,
      recipientAddress: parcels.recipientAddress,
      parcelType: parcels.parcelType,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      totalAmountToCollect: parcels.totalAmountToCollect,
      deliveryFeePayer: parcels.deliveryFeePayer,
      parcelStatus: parcels.status,
      deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
      codStatus: parcelPaymentRecords.codStatus,
      collectedAmount: parcelPaymentRecords.collectedAmount,
      collectionStatus: parcelPaymentRecords.collectionStatus,
      merchantSettlementStatus: parcelPaymentRecords.merchantSettlementStatus,
      riderPayoutStatus: parcelPaymentRecords.riderPayoutStatus,
      paymentNote: parcelPaymentRecords.note,
      createdAt: parcels.createdAt,
      updatedAt: parcels.updatedAt,
    })
    .from(parcels)
    .innerJoin(merchants, eq(parcels.merchantId, merchants.appUserId))
    .leftJoin(riders, eq(parcels.riderId, riders.appUserId))
    .leftJoin(appUsers, eq(riders.appUserId, appUsers.id))
    .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
    .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
    .where(eq(parcels.id, parcelId))
    .limit(1);

  if (!row) {
    return null;
  }

  return toParcelDetailDto(row);
}

export async function getParcelByIdForViewer(
  viewer: Pick<AppAccessContext, "appUserId" | "roleSlug" | "permissions">,
  parcelId: string,
): Promise<ParcelDetailDto | null> {
  const parcel = await findParcelDetailById(parcelId);

  if (!parcel) {
    return null;
  }

  const parcelAccess = getParcelAccess({
    viewer,
    parcel: {
      merchantId: parcel.merchantId,
      riderId: parcel.riderId,
    },
  });

  if (!parcelAccess.canView) {
    return null;
  }

  return parcel;
}

export async function isParcelCodeInUse(parcelCode: string): Promise<boolean> {
  const [row] = await db
    .select({ id: parcels.id })
    .from(parcels)
    .where(eq(parcels.parcelCode, parcelCode))
    .limit(1);

  return Boolean(row?.id);
}

export async function getParcelFormOptions(input?: { merchantId?: string | null }): Promise<{
  merchants: ParcelOptionDto[];
  riders: ParcelOptionDto[];
  townships: ParcelOptionDto[];
}> {
  const [merchantRows, riderRows, townshipRows] = await Promise.all([
    db
      .select({
        id: merchants.appUserId,
        label: merchants.shopName,
      })
      .from(merchants)
      .where(
        input?.merchantId
          ? and(isNull(merchants.deletedAt), eq(merchants.appUserId, input.merchantId))
          : isNull(merchants.deletedAt),
      )
      .orderBy(asc(merchants.shopName)),
    db
      .select({
        id: riders.appUserId,
        label: appUsers.fullName,
      })
      .from(riders)
      .innerJoin(appUsers, eq(riders.appUserId, appUsers.id))
      .where(and(isNull(riders.deletedAt), isNull(appUsers.deletedAt), eq(riders.isActive, true)))
      .orderBy(asc(appUsers.fullName)),
    db
      .select({
        id: townships.id,
        label: townships.name,
      })
      .from(townships)
      .where(eq(townships.isActive, true))
      .orderBy(asc(townships.name)),
  ]);

  return {
    merchants: merchantRows,
    riders: riderRows,
    townships: townshipRows,
  };
}

export async function createParcelWithPaymentAndAudit(input: {
  actorAppUserId: string;
  parcelValues: CreateParcelInsertInput;
  paymentValues: CreatePaymentInsertInput;
}) {
  const created = await db.transaction(async (tx) => {
    const [parcel] = await tx
      .insert(parcels)
      .values({
        ...input.parcelValues,
      })
      .returning({ id: parcels.id });

    const [payment] = await tx
      .insert(parcelPaymentRecords)
      .values({
        parcelId: parcel.id,
        ...input.paymentValues,
      })
      .returning({ id: parcelPaymentRecords.id });

    const parcelAuditPayload: AuditLogInsertInput = {
      parcelId: parcel.id,
      updatedBy: input.actorAppUserId,
      sourceTable: "parcels",
      event: "parcel.create",
      oldValues: null,
      newValues: input.parcelValues,
    };
    const paymentAuditPayload: AuditLogInsertInput = {
      parcelId: parcel.id,
      updatedBy: input.actorAppUserId,
      sourceTable: "parcel_payment_records",
      event: "parcel_payment_record.create",
      oldValues: null,
      newValues: input.paymentValues,
    };

    await tx.insert(parcelAuditLogs).values([parcelAuditPayload, paymentAuditPayload]);

    return { parcelId: parcel.id, paymentRecordId: payment.id };
  });

  return created;
}

async function findParcelUpdateContextById(
  parcelId: string,
): Promise<ParcelUpdateContextDto | null> {
  const [row] = await db
    .select({
      parcelId: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantId: parcels.merchantId,
      riderId: parcels.riderId,
      recipientName: parcels.recipientName,
      recipientPhone: parcels.recipientPhone,
      recipientTownshipId: parcels.recipientTownshipId,
      recipientAddress: parcels.recipientAddress,
      parcelType: parcels.parcelType,
      codAmount: parcels.codAmount,
      deliveryFee: parcels.deliveryFee,
      totalAmountToCollect: parcels.totalAmountToCollect,
      deliveryFeePayer: parcels.deliveryFeePayer,
      parcelStatus: parcels.status,
      paymentId: parcelPaymentRecords.id,
      deliveryFeeStatus: parcelPaymentRecords.deliveryFeeStatus,
      codStatus: parcelPaymentRecords.codStatus,
      collectedAmount: parcelPaymentRecords.collectedAmount,
      collectionStatus: parcelPaymentRecords.collectionStatus,
      merchantSettlementStatus: parcelPaymentRecords.merchantSettlementStatus,
      riderPayoutStatus: parcelPaymentRecords.riderPayoutStatus,
      paymentNote: parcelPaymentRecords.note,
    })
    .from(parcels)
    .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
    .where(eq(parcels.id, parcelId))
    .limit(1);

  if (!row?.paymentId) {
    return null;
  }

  return toParcelUpdateContextDto(row);
}

export async function getParcelUpdateContextForViewer(
  viewer: Pick<AppAccessContext, "appUserId" | "roleSlug" | "permissions">,
  parcelId: string,
): Promise<ParcelUpdateContextDto | null> {
  const current = await findParcelUpdateContextById(parcelId);

  if (!current) {
    return null;
  }

  const parcelAccess = getParcelAccess({
    viewer,
    parcel: {
      merchantId: current.parcel.merchantId,
      riderId: current.parcel.riderId,
    },
  });

  if (!parcelAccess.canView) {
    return null;
  }

  return current;
}

export async function updateParcelAndPaymentWithAudit(input: {
  actorAppUserId: string;
  parcelId: string;
  parcelPatch: ParcelUpdatePatch;
  paymentPatch: ParcelPaymentUpdatePatch;
  parcelOldValues: Record<string, unknown> | null;
  paymentOldValues: Record<string, unknown> | null;
  parcelEvent: string;
}) {
  await db.transaction(async (tx) => {
    if (Object.keys(input.parcelPatch).length > 0) {
      await tx
        .update(parcels)
        .set({
          ...input.parcelPatch,
          updatedAt: new Date(),
        })
        .where(eq(parcels.id, input.parcelId));

      await tx.insert(parcelAuditLogs).values({
        parcelId: input.parcelId,
        updatedBy: input.actorAppUserId,
        sourceTable: "parcels",
        event: input.parcelEvent,
        oldValues: input.parcelOldValues,
        newValues: input.parcelPatch,
      });
    }

    if (Object.keys(input.paymentPatch).length > 0) {
      await tx
        .update(parcelPaymentRecords)
        .set({
          ...input.paymentPatch,
          updatedAt: new Date(),
        })
        .where(eq(parcelPaymentRecords.parcelId, input.parcelId));

      await tx.insert(parcelAuditLogs).values({
        parcelId: input.parcelId,
        updatedBy: input.actorAppUserId,
        sourceTable: "parcel_payment_records",
        event: "parcel_payment_record.update",
        oldValues: input.paymentOldValues,
        newValues: input.paymentPatch,
      });
    }
  });
}

export function buildParcelPatch(input: {
  current: ParcelUpdateContextDto["parcel"];
  next: {
    merchantId: string;
    riderId: string | null;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
    parcelType: "cod" | "non_cod";
    codAmount: number;
    deliveryFee: number;
    totalAmountToCollect: number;
    deliveryFeePayer: "merchant" | "receiver";
    parcelStatus:
      | "pending"
      | "out_for_pickup"
      | "at_office"
      | "out_for_delivery"
      | "delivered"
      | "return_to_office"
      | "return_to_merchant"
      | "returned"
      | "cancelled";
  };
}) {
  const nextValues: ParcelUpdatePatch = {
    merchantId: input.next.merchantId,
    riderId: input.next.riderId,
    recipientName: input.next.recipientName,
    recipientPhone: input.next.recipientPhone,
    recipientTownshipId: input.next.recipientTownshipId,
    recipientAddress: input.next.recipientAddress,
    parcelType: input.next.parcelType,
    codAmount: toMoneyString(input.next.codAmount),
    deliveryFee: toMoneyString(input.next.deliveryFee),
    totalAmountToCollect: toMoneyString(input.next.totalAmountToCollect),
    deliveryFeePayer: input.next.deliveryFeePayer,
    status: input.next.parcelStatus,
  };
  const patch: ParcelUpdatePatch = {};
  const oldValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(nextValues)) {
    const keyName = key as keyof ParcelUpdatePatch;
    const currentValue = input.current[keyName];

    if (currentValue !== value) {
      patch[keyName] = value as never;
      oldValues[keyName] = currentValue;
    }
  }

  return { patch, oldValues: Object.keys(oldValues).length > 0 ? oldValues : null };
}

export function buildPaymentPatch(input: {
  current: ParcelUpdateContextDto["payment"];
  next: {
    deliveryFeeStatus:
      | "unpaid"
      | "paid_by_merchant"
      | "collected_from_receiver"
      | "deduct_from_settlement"
      | "bill_merchant"
      | "waived";
    codStatus: "not_applicable" | "pending" | "collected" | "not_collected";
    collectedAmount: number;
    collectionStatus:
      | "pending"
      | "not_collected"
      | "collected_by_rider"
      | "received_by_office"
      | "void";
    merchantSettlementStatus: "pending" | "in_progress" | "settled";
    riderPayoutStatus: "pending" | "in_progress" | "paid";
    paymentNote: string | null;
  };
}) {
  const nextValues: ParcelPaymentUpdatePatch = {
    deliveryFeeStatus: input.next.deliveryFeeStatus,
    codStatus: input.next.codStatus,
    collectedAmount: toMoneyString(input.next.collectedAmount),
    collectionStatus: input.next.collectionStatus,
    merchantSettlementStatus: input.next.merchantSettlementStatus,
    riderPayoutStatus: input.next.riderPayoutStatus,
    note: input.next.paymentNote,
  };
  const patch: ParcelPaymentUpdatePatch = {};
  const oldValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(nextValues)) {
    const keyName = key as keyof ParcelPaymentUpdatePatch;
    const currentValue = input.current[keyName];

    if (currentValue !== value) {
      patch[keyName] = value as never;
      oldValues[keyName] = currentValue;
    }
  }

  return { patch, oldValues: Object.keys(oldValues).length > 0 ? oldValues : null };
}
