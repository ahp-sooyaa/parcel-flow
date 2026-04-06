import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ROLE_SLUGS } from "@/db/constants";

const PARCEL_TYPES = ["cod", "non_cod"] as const;
const DELIVERY_FEE_PAYER_VALUES = ["merchant", "receiver"] as const;
const PARCEL_STATUS_VALUES = [
  "pending",
  "out_for_pickup",
  "at_office",
  "out_for_delivery",
  "delivered",
  "return_to_office",
  "return_to_merchant",
  "returned",
  "cancelled",
] as const;
const DELIVERY_FEE_STATUS_VALUES = [
  "unpaid",
  "paid_by_merchant",
  "collected_from_receiver",
  "deduct_from_settlement",
  "bill_merchant",
  "waived",
] as const;
const COD_STATUS_VALUES = ["not_applicable", "pending", "collected", "not_collected"] as const;
const COLLECTION_STATUS_VALUES = [
  "pending",
  "not_collected",
  "collected_by_rider",
  "received_by_office",
  "void",
] as const;
const SETTLEMENT_STATUS_VALUES = ["pending", "in_progress", "settled"] as const;
const PAYOUT_STATUS_VALUES = ["pending", "in_progress", "paid"] as const;
const PARCEL_AUDIT_SOURCE_VALUES = ["parcels", "parcel_payment_records"] as const;

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug", { enum: ROLE_SLUGS }).notNull().unique(),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("roles_slug_uidx").on(table.slug)],
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("permissions_slug_uidx").on(table.slug)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("role_permissions_role_permission_uidx").on(table.roleId, table.permissionId),
    index("role_permissions_role_idx").on(table.roleId),
    index("role_permissions_permission_idx").on(table.permissionId),
  ],
);

export const appUsers = pgTable(
  "app_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supabaseUserId: uuid("supabase_user_id").notNull().unique(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phoneNumber: text("phone_number"),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    isActive: boolean("is_active").default(true).notNull(),
    mustResetPassword: boolean("must_reset_password").default(true).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("app_users_supabase_user_uidx").on(table.supabaseUserId),
    uniqueIndex("app_users_email_uidx").on(table.email),
    index("app_users_role_idx").on(table.roleId),
    index("app_users_active_idx").on(table.isActive),
    index("app_users_deleted_at_idx").on(table.deletedAt),
  ],
);

export const townships = pgTable(
  "townships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("townships_name_uidx").on(table.name),
    index("townships_active_idx").on(table.isActive),
    index("townships_created_at_idx").on(table.createdAt),
  ],
);

export const merchants = pgTable(
  "merchants",
  {
    appUserId: uuid("app_user_id")
      .primaryKey()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    shopName: text("shop_name").notNull(),
    pickupTownshipId: uuid("pickup_township_id").references(() => townships.id, {
      onDelete: "restrict",
    }),
    defaultPickupAddress: text("default_pickup_address"),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("merchants_shop_name_idx").on(table.shopName),
    index("merchants_pickup_township_idx").on(table.pickupTownshipId),
    index("merchants_created_at_idx").on(table.createdAt),
    index("merchants_deleted_at_idx").on(table.deletedAt),
  ],
);

export const riders = pgTable(
  "riders",
  {
    appUserId: uuid("app_user_id")
      .primaryKey()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    townshipId: uuid("township_id").references(() => townships.id, {
      onDelete: "restrict",
    }),
    vehicleType: text("vehicle_type").notNull().default("bike"),
    licensePlate: text("license_plate"),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("riders_township_idx").on(table.townshipId),
    index("riders_vehicle_type_idx").on(table.vehicleType),
    index("riders_active_idx").on(table.isActive),
    index("riders_created_at_idx").on(table.createdAt),
    index("riders_deleted_at_idx").on(table.deletedAt),
  ],
);

export const parcels = pgTable(
  "parcels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parcelCode: text("parcel_code").notNull(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.appUserId, { onDelete: "restrict" }),
    riderId: uuid("rider_id").references(() => riders.appUserId, { onDelete: "set null" }),
    recipientName: text("recipient_name").notNull(),
    recipientPhone: text("recipient_phone").notNull(),
    recipientTownshipId: uuid("recipient_township_id")
      .notNull()
      .references(() => townships.id, { onDelete: "restrict" }),
    recipientAddress: text("recipient_address").notNull(),
    codAmount: numeric("cod_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    deliveryFee: numeric("delivery_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    deliveryFeePayer: text("delivery_fee_payer", { enum: DELIVERY_FEE_PAYER_VALUES })
      .notNull()
      .default("receiver"),
    parcelType: text("parcel_type", { enum: PARCEL_TYPES }).notNull().default("cod"),
    totalAmountToCollect: numeric("total_amount_to_collect", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    status: text("status", { enum: PARCEL_STATUS_VALUES }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("parcels_code_uidx").on(table.parcelCode),
    index("parcels_merchant_idx").on(table.merchantId),
    index("parcels_rider_idx").on(table.riderId),
    index("parcels_recipient_township_idx").on(table.recipientTownshipId),
    index("parcels_status_idx").on(table.status),
    index("parcels_created_at_idx").on(table.createdAt),
  ],
);

export const parcelPaymentRecords = pgTable(
  "parcel_payment_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parcelId: uuid("parcel_id")
      .notNull()
      .references(() => parcels.id, { onDelete: "cascade" }),
    deliveryFeeStatus: text("delivery_fee_status", { enum: DELIVERY_FEE_STATUS_VALUES })
      .notNull()
      .default("unpaid"),
    codStatus: text("cod_status", { enum: COD_STATUS_VALUES }).notNull().default("pending"),
    collectedAmount: numeric("collected_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    collectionStatus: text("collection_status", { enum: COLLECTION_STATUS_VALUES })
      .notNull()
      .default("pending"),
    merchantSettlementStatus: text("merchant_settlement_status", { enum: SETTLEMENT_STATUS_VALUES })
      .notNull()
      .default("pending"),
    riderPayoutStatus: text("rider_payout_status", { enum: PAYOUT_STATUS_VALUES })
      .notNull()
      .default("pending"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("parcel_payment_records_parcel_uidx").on(table.parcelId),
    index("parcel_payment_records_delivery_fee_status_idx").on(table.deliveryFeeStatus),
    index("parcel_payment_records_collection_status_idx").on(table.collectionStatus),
    index("parcel_payment_records_merchant_settlement_idx").on(table.merchantSettlementStatus),
    index("parcel_payment_records_rider_payout_idx").on(table.riderPayoutStatus),
  ],
);

export const parcelAuditLogs = pgTable(
  "parcel_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parcelId: uuid("parcel_id")
      .notNull()
      .references(() => parcels.id, { onDelete: "cascade" }),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => appUsers.id, { onDelete: "restrict" }),
    sourceTable: text("source_table", { enum: PARCEL_AUDIT_SOURCE_VALUES }).notNull(),
    event: text("event").notNull(),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("parcel_audit_logs_parcel_idx").on(table.parcelId),
    index("parcel_audit_logs_updated_by_idx").on(table.updatedBy),
    index("parcel_audit_logs_source_table_idx").on(table.sourceTable),
    index("parcel_audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type AppUser = typeof appUsers.$inferSelect;
export type NewAppUser = typeof appUsers.$inferInsert;
export type Township = typeof townships.$inferSelect;
export type NewTownship = typeof townships.$inferInsert;
export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
export type Rider = typeof riders.$inferSelect;
export type NewRider = typeof riders.$inferInsert;
export type Parcel = typeof parcels.$inferSelect;
export type NewParcel = typeof parcels.$inferInsert;
export type ParcelPaymentRecord = typeof parcelPaymentRecords.$inferSelect;
export type NewParcelPaymentRecord = typeof parcelPaymentRecords.$inferInsert;
export type ParcelAuditLog = typeof parcelAuditLogs.$inferSelect;
export type NewParcelAuditLog = typeof parcelAuditLogs.$inferInsert;
