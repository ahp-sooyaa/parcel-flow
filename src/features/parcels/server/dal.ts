import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  toMerchantParcelListItemDto,
  toParcelDetailDto,
  toParcelListItemDto,
  toRiderParcelDetailDto,
  type ParcelDetailDto,
  type ParcelListItemDto,
  type ParcelOptionDto,
  type RiderParcelDetailDto,
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
  getNextRiderParcelAction,
  isAdminDashboardRole,
  toMoneyString,
  type ParcelViewerContext,
} from "@/features/parcels/server/utils";

type AuditLogInsertInput = {
  parcelId: string;
  updatedBy: string;
  sourceTable: "parcels" | "parcel_payment_records";
  event: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
};

type CreateParcelInsertInput = {
  parcelCode: string;
  merchantId: string;
  riderId: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientTownshipId: string;
  recipientAddress: string;
  parcelType: "cod" | "non_cod";
  codAmount: string;
  deliveryFee: string;
  totalAmountToCollect: string;
  deliveryFeePayer: "merchant" | "receiver";
  status: "pending";
};

type CreatePaymentInsertInput = {
  deliveryFeeStatus:
    | "unpaid"
    | "paid_by_merchant"
    | "collected_from_receiver"
    | "deduct_from_settlement"
    | "bill_merchant"
    | "waived";
  codStatus: "not_applicable" | "pending";
  collectedAmount: string;
  collectionStatus: "pending";
  merchantSettlementStatus: "pending";
  riderPayoutStatus: "pending";
  note: string | null;
};

type ParcelUpdatePatch = Partial<{
  merchantId: string;
  riderId: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientTownshipId: string;
  recipientAddress: string;
  parcelType: "cod" | "non_cod";
  codAmount: string;
  deliveryFee: string;
  totalAmountToCollect: string;
  deliveryFeePayer: "merchant" | "receiver";
  status:
    | "pending"
    | "out_for_pickup"
    | "at_office"
    | "out_for_delivery"
    | "delivered"
    | "return_to_office"
    | "return_to_merchant"
    | "returned"
    | "cancelled";
}>;

type ParcelPaymentUpdatePatch = Partial<{
  deliveryFeeStatus:
    | "unpaid"
    | "paid_by_merchant"
    | "collected_from_receiver"
    | "deduct_from_settlement"
    | "bill_merchant"
    | "waived";
  codStatus: "not_applicable" | "pending" | "collected" | "not_collected";
  collectedAmount: string;
  collectionStatus:
    | "pending"
    | "not_collected"
    | "collected_by_rider"
    | "received_by_office"
    | "void";
  merchantSettlementStatus: "pending" | "in_progress" | "settled";
  riderPayoutStatus: "pending" | "in_progress" | "paid";
  note: string | null;
}>;

type ParcelUpdateContext = {
  parcel: {
    id: string;
    parcelCode: string;
    merchantId: string;
    riderId: string | null;
    recipientName: string;
    recipientPhone: string;
    recipientTownshipId: string;
    recipientAddress: string;
    parcelType: "cod" | "non_cod";
    codAmount: string;
    deliveryFee: string;
    totalAmountToCollect: string;
    deliveryFeePayer: "merchant" | "receiver";
    status:
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
  payment: {
    id: string;
    deliveryFeeStatus:
      | "unpaid"
      | "paid_by_merchant"
      | "collected_from_receiver"
      | "deduct_from_settlement"
      | "bill_merchant"
      | "waived";
    codStatus: "not_applicable" | "pending" | "collected" | "not_collected";
    collectedAmount: string;
    collectionStatus:
      | "pending"
      | "not_collected"
      | "collected_by_rider"
      | "received_by_office"
      | "void";
    merchantSettlementStatus: "pending" | "in_progress" | "settled";
    riderPayoutStatus: "pending" | "in_progress" | "paid";
    note: string | null;
  };
};

const riderAppUsers = alias(appUsers, "rider_app_users");

function buildParcelViewerAccessFilter(viewer: ParcelViewerContext) {
  if (isAdminDashboardRole(viewer.role.slug)) {
    return undefined;
  }

  if (viewer.role.slug === "merchant") {
    return viewer.linkedMerchantId
      ? eq(parcels.merchantId, viewer.linkedMerchantId)
      : eq(parcels.id, "");
  }

  if (viewer.role.slug === "rider") {
    return viewer.linkedRiderId ? eq(parcels.riderId, viewer.linkedRiderId) : eq(parcels.id, "");
  }

  return eq(parcels.id, "");
}

export async function getParcelsList(viewer: ParcelViewerContext): Promise<ParcelListItemDto[]> {
  const accessFilter = buildParcelViewerAccessFilter(viewer);
  const rows = await db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
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
    .where(accessFilter)
    .orderBy(desc(parcels.createdAt));

  return rows.map((row) =>
    toParcelListItemDto({
      id: row.id,
      parcelCode: row.parcelCode,
      merchantLabel: row.merchantLabel,
      recipientName: row.recipientName,
      recipientTownshipName: row.recipientTownshipName,
      parcelStatus: row.parcelStatus,
      deliveryFeeStatus: row.deliveryFeeStatus ?? "unpaid",
      collectionStatus: row.collectionStatus ?? "pending",
      createdAt: row.createdAt,
    }),
  );
}

export async function getMerchantParcelsList(
  viewer: ParcelViewerContext,
  merchantId: string,
): Promise<ParcelListItemDto[]> {
  const accessFilter = buildParcelViewerAccessFilter(viewer);
  const whereClause = accessFilter
    ? and(accessFilter, eq(parcels.merchantId, merchantId))
    : eq(parcels.merchantId, merchantId);
  const rows = await db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
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
    .where(whereClause)
    .orderBy(desc(parcels.createdAt));

  return rows.map((row) =>
    toMerchantParcelListItemDto({
      id: row.id,
      parcelCode: row.parcelCode,
      merchantLabel: row.merchantLabel,
      recipientName: row.recipientName,
      recipientTownshipName: row.recipientTownshipName,
      parcelStatus: row.parcelStatus,
      deliveryFeeStatus: row.deliveryFeeStatus ?? "unpaid",
      collectionStatus: row.collectionStatus ?? "pending",
      createdAt: row.createdAt,
    }),
  );
}

export async function getAssignedRiderParcelsList(
  viewer: ParcelViewerContext,
  riderId: string,
): Promise<ParcelListItemDto[]> {
  const accessFilter = buildParcelViewerAccessFilter(viewer);
  const whereClause = accessFilter
    ? and(accessFilter, eq(parcels.riderId, riderId))
    : eq(parcels.riderId, riderId);
  const rows = await db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
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
    .where(whereClause)
    .orderBy(desc(parcels.createdAt));

  return rows.map((row) =>
    toParcelListItemDto({
      id: row.id,
      parcelCode: row.parcelCode,
      merchantLabel: row.merchantLabel,
      recipientName: row.recipientName,
      recipientTownshipName: row.recipientTownshipName,
      parcelStatus: row.parcelStatus,
      deliveryFeeStatus: row.deliveryFeeStatus ?? "unpaid",
      collectionStatus: row.collectionStatus ?? "pending",
      createdAt: row.createdAt,
    }),
  );
}

export async function getParcelById(
  parcelId: string,
  viewer: ParcelViewerContext,
): Promise<ParcelDetailDto | null> {
  const accessFilter = buildParcelViewerAccessFilter(viewer);
  const [row] = await db
    .select({
      id: parcels.id,
      parcelCode: parcels.parcelCode,
      merchantId: parcels.merchantId,
      merchantLabel: merchants.shopName,
      riderId: parcels.riderId,
      riderLabel: riderAppUsers.fullName,
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
    .leftJoin(riderAppUsers, eq(riders.appUserId, riderAppUsers.id))
    .leftJoin(townships, eq(parcels.recipientTownshipId, townships.id))
    .leftJoin(parcelPaymentRecords, eq(parcelPaymentRecords.parcelId, parcels.id))
    .where(and(eq(parcels.id, parcelId), accessFilter))
    .limit(1);

  if (!row) {
    return null;
  }

  return toParcelDetailDto({
    id: row.id,
    parcelCode: row.parcelCode,
    merchantId: row.merchantId,
    merchantLabel: row.merchantLabel,
    riderId: row.riderId,
    riderLabel: row.riderLabel,
    recipientName: row.recipientName,
    recipientPhone: row.recipientPhone,
    recipientTownshipId: row.recipientTownshipId,
    recipientTownshipName: row.recipientTownshipName,
    recipientAddress: row.recipientAddress,
    parcelType: row.parcelType,
    codAmount: row.codAmount,
    deliveryFee: row.deliveryFee,
    totalAmountToCollect: row.totalAmountToCollect,
    deliveryFeePayer: row.deliveryFeePayer,
    parcelStatus: row.parcelStatus,
    deliveryFeeStatus: row.deliveryFeeStatus ?? "unpaid",
    codStatus: row.codStatus ?? "pending",
    collectedAmount: row.collectedAmount ?? "0",
    collectionStatus: row.collectionStatus ?? "pending",
    merchantSettlementStatus: row.merchantSettlementStatus ?? "pending",
    riderPayoutStatus: row.riderPayoutStatus ?? "pending",
    paymentNote: row.paymentNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function getRiderParcelById(
  parcelId: string,
  viewer: ParcelViewerContext,
): Promise<RiderParcelDetailDto | null> {
  const parcel = await getParcelById(parcelId, viewer);

  if (!parcel) {
    return null;
  }

  return toRiderParcelDetailDto({
    id: parcel.id,
    parcelCode: parcel.parcelCode,
    merchantLabel: parcel.merchantLabel,
    riderLabel: parcel.riderLabel,
    recipientName: parcel.recipientName,
    recipientPhone: parcel.recipientPhone,
    recipientTownshipName: parcel.recipientTownshipName,
    recipientAddress: parcel.recipientAddress,
    parcelType: parcel.parcelType,
    parcelStatus: parcel.parcelStatus,
    codAmount: parcel.codAmount,
    totalAmountToCollect: parcel.totalAmountToCollect,
    collectionStatus: parcel.collectionStatus,
    nextAction: getNextRiderParcelAction(parcel.parcelStatus),
  });
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

export async function getParcelUpdateContext(
  parcelId: string,
  viewer: ParcelViewerContext,
): Promise<ParcelUpdateContext | null> {
  const accessFilter = buildParcelViewerAccessFilter(viewer);
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
    .where(and(eq(parcels.id, parcelId), accessFilter))
    .limit(1);

  if (!row?.paymentId) {
    return null;
  }

  return {
    parcel: {
      id: row.parcelId,
      parcelCode: row.parcelCode,
      merchantId: row.merchantId,
      riderId: row.riderId,
      recipientName: row.recipientName,
      recipientPhone: row.recipientPhone,
      recipientTownshipId: row.recipientTownshipId,
      recipientAddress: row.recipientAddress,
      parcelType: row.parcelType,
      codAmount: row.codAmount,
      deliveryFee: row.deliveryFee,
      totalAmountToCollect: row.totalAmountToCollect,
      deliveryFeePayer: row.deliveryFeePayer,
      status: row.parcelStatus,
    },
    payment: {
      id: row.paymentId,
      deliveryFeeStatus: row.deliveryFeeStatus ?? "unpaid",
      codStatus: row.codStatus ?? "pending",
      collectedAmount: row.collectedAmount ?? "0",
      collectionStatus: row.collectionStatus ?? "pending",
      merchantSettlementStatus: row.merchantSettlementStatus ?? "pending",
      riderPayoutStatus: row.riderPayoutStatus ?? "pending",
      note: row.paymentNote,
    },
  };
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
  current: ParcelUpdateContext["parcel"];
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
  current: ParcelUpdateContext["payment"];
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
