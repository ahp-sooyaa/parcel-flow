import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

const softDeleteTimestamps = {
  ...timestamps,
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const appUsers = pgTable(
  "app_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    phoneNumber: text("phone_number").notNull(),
    email: text("email"),
    role: text("role").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    mustResetPassword: boolean("must_reset_password").default(false).notNull(),
    ...softDeleteTimestamps,
  },
  (table) => [uniqueIndex("app_users_phone_number_idx").on(table.phoneNumber)],
);

export const merchants = pgTable("merchants", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => appUsers.id),
  shopName: text("shop_name").notNull(),
  address: text("address").notNull(),
  ...timestamps,
});

export const townships = pgTable("townships", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  baseFee: integer("base_fee").notNull(),
  baseWeightKg: numeric("base_weight_kg", { precision: 10, scale: 2 }).default("3").notNull(),
  extraWeightFee: integer("extra_weight_fee").default(0).notNull(),
  extraWeightUnitKg: numeric("extra_weight_unit_kg", { precision: 10, scale: 2 })
    .default("1")
    .notNull(),
  volumetricDivisor: integer("volumetric_divisor").default(5000).notNull(),
  codFeePercent: numeric("cod_fee_percent", { precision: 5, scale: 2 }).default("0").notNull(),
  returnFeePercent: numeric("return_fee_percent", { precision: 5, scale: 2 })
    .default("100")
    .notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const riders = pgTable("riders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => appUsers.id),
  name: text("name").notNull(),
  age: integer("age"),
  address: text("address").notNull(),
  ...timestamps,
});

export const riderServiceTownships = pgTable(
  "rider_service_townships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    riderId: uuid("rider_id")
      .notNull()
      .references(() => riders.id),
    townshipId: uuid("township_id")
      .notNull()
      .references(() => townships.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("rider_service_townships_rider_township_idx").on(table.riderId, table.townshipId),
  ],
);

export const parcels = pgTable(
  "parcels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parcelCode: text("parcel_code").notNull(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),
    riderId: uuid("rider_id").references(() => riders.id),
    townshipId: uuid("township_id")
      .notNull()
      .references(() => townships.id),
    receiverName: text("receiver_name").notNull(),
    receiverPhoneNumber: text("receiver_phone_number").notNull(),
    receiverAddress: text("receiver_address").notNull(),
    parcelType: text("parcel_type").notNull(),
    codAmount: integer("cod_amount").default(0).notNull(),
    deliveryFee: integer("delivery_fee").notNull(),
    weightKg: numeric("weight_kg", { precision: 10, scale: 2 }).default("3").notNull(),
    isLargeParcel: boolean("is_large_parcel").default(false).notNull(),
    parcelWidthCm: numeric("parcel_width_cm", { precision: 10, scale: 2 }),
    parcelHeightCm: numeric("parcel_height_cm", { precision: 10, scale: 2 }),
    parcelLengthCm: numeric("parcel_length_cm", { precision: 10, scale: 2 }),
    specialNotes: text("special_notes"),
    status: text("status").default("at_office").notNull(),
    collectedAmount: integer("collected_amount").default(0).notNull(),
    codStatus: text("cod_status").default("pending").notNull(),
    deliveryFeeStatus: text("delivery_fee_status").default("pending").notNull(),
    isReceivedByOffice: boolean("is_received_by_office").default(false).notNull(),
    merchantSettlementStatus: text("merchant_settlement_status").default("pending").notNull(),
    riderPayoutStatus: text("rider_payout_status").default("pending").notNull(),
    proofOfDeliveryImagesKeys: jsonb("proof_of_delivery_images_keys")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),
    pickupImagesKeys: jsonb("pickup_images_keys")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),
    createdBy: uuid("created_by").references(() => appUsers.id),
    collectionConfirmedBy: uuid("collection_confirmed_by").references(() => appUsers.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    returnedToMerchantAt: timestamp("returned_to_merchant_at", { withTimezone: true }),
    collectedAt: timestamp("collected_at", { withTimezone: true }),
    ...softDeleteTimestamps,
  },
  (table) => [uniqueIndex("parcels_parcel_code_idx").on(table.parcelCode)],
);

export const financialItems = pgTable("financial_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  parcelId: uuid("parcel_id").references(() => parcels.id),
  merchantId: uuid("merchant_id").references(() => merchants.id),
  riderId: uuid("rider_id").references(() => riders.id),
  merchantSettlementId: uuid("merchant_settlement_id").references(() => merchantSettlements.id),
  riderPayoutId: uuid("rider_payout_id").references(() => riderPayouts.id),
  itemType: text("item_type").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").default("pending").notNull(),
  createdBy: uuid("created_by").references(() => appUsers.id),
  ...timestamps,
  settledAt: timestamp("settled_at", { withTimezone: true }),
});

export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => appUsers.id),
  bankName: text("bank_name").notNull(),
  accountHolderName: text("account_holder_name").notNull(),
  accountNumber: text("account_number").notNull(),
  isCompanyAccount: boolean("is_company_account").default(false).notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  ...softDeleteTimestamps,
});

export const merchantSettlements = pgTable(
  "merchant_settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    settlementCode: text("settlement_code").notNull(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id),
    status: text("status").default("in_progress").notNull(),
    totalCodAmount: integer("total_cod_amount").default(0).notNull(),
    totalDeliveryFeeDeduction: integer("total_delivery_fee_deduction").default(0).notNull(),
    netPaymentAmount: integer("net_payment_amount").default(0).notNull(),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id),
    createdBy: uuid("created_by").references(() => appUsers.id),
    paidBy: uuid("paid_by").references(() => appUsers.id),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentNote: text("payment_note"),
    ...timestamps,
  },
  (table) => [uniqueIndex("merchant_settlements_settlement_code_idx").on(table.settlementCode)],
);

export const riderPayouts = pgTable(
  "rider_payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payoutCode: text("payout_code").notNull(),
    riderId: uuid("rider_id")
      .notNull()
      .references(() => riders.id),
    status: text("status").default("in_progress").notNull(),
    deliveredWayCount: integer("delivered_way_count").default(0).notNull(),
    feePerWay: integer("fee_per_way").notNull(),
    totalPayoutAmount: integer("total_payout_amount").default(0).notNull(),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id),
    createdBy: uuid("created_by").references(() => appUsers.id),
    paidBy: uuid("paid_by").references(() => appUsers.id),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentNote: text("payment_note"),
    ...timestamps,
  },
  (table) => [uniqueIndex("rider_payouts_payout_code_idx").on(table.payoutCode)],
);

export const parcelStatusLogs = pgTable("parcel_status_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  parcelId: uuid("parcel_id")
    .notNull()
    .references(() => parcels.id),
  oldStatus: text("old_status"),
  newStatus: text("new_status").notNull(),
  changedBy: uuid("changed_by").references(() => appUsers.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appUsersRelations = relations(appUsers, ({ many, one }) => ({
  merchant: one(merchants),
  rider: one(riders),
  bankAccounts: many(bankAccounts),
}));

export const merchantsRelations = relations(merchants, ({ many, one }) => ({
  user: one(appUsers, { fields: [merchants.userId], references: [appUsers.id] }),
  parcels: many(parcels),
  settlements: many(merchantSettlements),
}));

export const ridersRelations = relations(riders, ({ many, one }) => ({
  user: one(appUsers, { fields: [riders.userId], references: [appUsers.id] }),
  parcels: many(parcels),
  payouts: many(riderPayouts),
  serviceTownships: many(riderServiceTownships),
}));

export const parcelsRelations = relations(parcels, ({ many, one }) => ({
  merchant: one(merchants, { fields: [parcels.merchantId], references: [merchants.id] }),
  rider: one(riders, { fields: [parcels.riderId], references: [riders.id] }),
  township: one(townships, { fields: [parcels.townshipId], references: [townships.id] }),
  financialItems: many(financialItems),
  statusLogs: many(parcelStatusLogs),
}));
