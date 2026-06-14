import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  index,
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
  "user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    username: text("username").notNull(),
    displayUsername: text("display_username"),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    phoneNumber: text("phone_number").notNull(),
    address: text("address").default("").notNull(),
    age: integer("age"),
    role: text("role").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    mustResetPassword: boolean("must_reset_password").default(false).notNull(),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    ...softDeleteTimestamps,
  },
  (table) => [
    uniqueIndex("user_username_idx").on(table.username),
    uniqueIndex("user_email_idx").on(table.email),
    uniqueIndex("user_phone_number_idx").on(table.phoneNumber),
  ],
);

export const sessions = pgTable(
  "session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    impersonatedBy: uuid("impersonated_by").references(() => appUsers.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("session_token_idx").on(table.token),
    index("session_user_id_idx").on(table.userId),
  ],
);

export const accounts = pgTable(
  "account",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verifications = pgTable(
  "verification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const user = appUsers;
export const session = sessions;
export const account = accounts;
export const verification = verifications;

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
    deliveryFailureNote: jsonb("delivery_failure_note").$type<
      {
        note: string;
        status: "active" | "inactive";
      }[]
    >(),
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
    status: text("status").default("pending").notNull(),
    totalCodAmount: integer("total_cod_amount").default(0).notNull(),
    totalDeliveryFeeDeduction: integer("total_delivery_fee_deduction").default(0).notNull(),
    netPaymentAmount: integer("net_payment_amount").default(0).notNull(),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id),
    createdBy: uuid("created_by").references(() => appUsers.id),
    paidBy: uuid("paid_by").references(() => appUsers.id),
    bankTransferReceiptKey: text("bank_transfer_receipt_key"),
    bankTransferReceiptUploadedAt: timestamp("bank_transfer_receipt_uploaded_at", {
      withTimezone: true,
    }),
    bankTransferReceiptUploadedBy: uuid("bank_transfer_receipt_uploaded_by").references(
      () => appUsers.id,
    ),
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

export const parcelCorrectionLogs = pgTable(
  "parcel_correction_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parcelId: uuid("parcel_id")
      .notNull()
      .references(() => parcels.id),
    correctionType: text("correction_type").notNull(),
    oldStatus: text("old_status"),
    newStatus: text("new_status"),
    oldRiderId: uuid("old_rider_id").references(() => riders.id),
    newRiderId: uuid("new_rider_id").references(() => riders.id),
    statusLogId: uuid("status_log_id").references(() => parcelStatusLogs.id),
    reason: text("reason").notNull(),
    sideEffects: jsonb("side_effects")
      .$type<{ summary: string[] }>()
      .default(sql`'{"summary":[]}'::jsonb`)
      .notNull(),
    createdBy: uuid("created_by").references(() => appUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("parcel_correction_logs_parcel_id_idx").on(table.parcelId),
    index("parcel_correction_logs_created_by_idx").on(table.createdBy),
    index("parcel_correction_logs_status_log_id_idx").on(table.statusLogId),
  ],
);

export const appUsersRelations = relations(appUsers, ({ many, one }) => ({
  merchant: one(merchants),
  rider: one(riders),
  bankAccounts: many(bankAccounts),
  parcelCorrections: many(parcelCorrectionLogs),
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
  correctionLogs: many(parcelCorrectionLogs),
}));

export const financialItemsRelations = relations(financialItems, ({ one }) => ({
  parcel: one(parcels, { fields: [financialItems.parcelId], references: [parcels.id] }),
  merchant: one(merchants, { fields: [financialItems.merchantId], references: [merchants.id] }),
  rider: one(riders, { fields: [financialItems.riderId], references: [riders.id] }),
  merchantSettlement: one(merchantSettlements, {
    fields: [financialItems.merchantSettlementId],
    references: [merchantSettlements.id],
  }),
  riderPayout: one(riderPayouts, {
    fields: [financialItems.riderPayoutId],
    references: [riderPayouts.id],
  }),
}));

export const merchantSettlementsRelations = relations(merchantSettlements, ({ many, one }) => ({
  merchant: one(merchants, {
    fields: [merchantSettlements.merchantId],
    references: [merchants.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [merchantSettlements.bankAccountId],
    references: [bankAccounts.id],
  }),
  createdByUser: one(appUsers, {
    fields: [merchantSettlements.createdBy],
    references: [appUsers.id],
  }),
  paidByUser: one(appUsers, {
    fields: [merchantSettlements.paidBy],
    references: [appUsers.id],
  }),
  receiptUploadedByUser: one(appUsers, {
    fields: [merchantSettlements.bankTransferReceiptUploadedBy],
    references: [appUsers.id],
  }),
  financialItems: many(financialItems),
}));

export const parcelStatusLogsRelations = relations(parcelStatusLogs, ({ many, one }) => ({
  parcel: one(parcels, { fields: [parcelStatusLogs.parcelId], references: [parcels.id] }),
  changedByUser: one(appUsers, {
    fields: [parcelStatusLogs.changedBy],
    references: [appUsers.id],
  }),
  correctionLogs: many(parcelCorrectionLogs),
}));

export const parcelCorrectionLogsRelations = relations(parcelCorrectionLogs, ({ one }) => ({
  parcel: one(parcels, {
    fields: [parcelCorrectionLogs.parcelId],
    references: [parcels.id],
  }),
  createdByUser: one(appUsers, {
    fields: [parcelCorrectionLogs.createdBy],
    references: [appUsers.id],
  }),
  oldRider: one(riders, {
    fields: [parcelCorrectionLogs.oldRiderId],
    references: [riders.id],
    relationName: "oldCorrectionRider",
  }),
  newRider: one(riders, {
    fields: [parcelCorrectionLogs.newRiderId],
    references: [riders.id],
    relationName: "newCorrectionRider",
  }),
  statusLog: one(parcelStatusLogs, {
    fields: [parcelCorrectionLogs.statusLogId],
    references: [parcelStatusLogs.id],
  }),
}));
