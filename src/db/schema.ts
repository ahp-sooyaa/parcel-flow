import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ROLE_SLUGS } from "@/db/constants";

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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("app_users_supabase_user_uidx").on(table.supabaseUserId),
    uniqueIndex("app_users_email_uidx").on(table.email),
    index("app_users_role_idx").on(table.roleId),
    index("app_users_active_idx").on(table.isActive),
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("merchants_shop_name_idx").on(table.shopName),
    index("merchants_pickup_township_idx").on(table.pickupTownshipId),
    index("merchants_created_at_idx").on(table.createdAt),
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("riders_township_idx").on(table.townshipId),
    index("riders_vehicle_type_idx").on(table.vehicleType),
    index("riders_active_idx").on(table.isActive),
    index("riders_created_at_idx").on(table.createdAt),
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
