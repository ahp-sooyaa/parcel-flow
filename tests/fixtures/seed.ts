import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/db/schema";
import {
  appUsers,
  bankAccounts,
  merchants,
  parcels,
  riders,
  riderServiceTownships,
  townships,
} from "@/db/schema";
import type { UserRole } from "@/lib/domain";

import { testRunId, uniqueTestId } from "./builders";

type TestDb = PostgresJsDatabase<typeof schema>;

export async function seedTestUser(
  db: TestDb,
  overrides: Partial<typeof appUsers.$inferInsert> & { role?: UserRole } = {},
) {
  const role = overrides.role ?? "merchant";
  const id = overrides.id ?? crypto.randomUUID();
  const username = overrides.username ?? uniqueTestId(role).replaceAll("_", "-");

  const [user] = await db
    .insert(appUsers)
    .values({
      id,
      name: overrides.name ?? `Test ${role}`,
      username,
      displayUsername: username,
      email: overrides.email ?? `${username}@internal.parcel-flow.test`,
      phoneNumber: overrides.phoneNumber ?? uniquePhoneNumber(),
      address: overrides.address ?? `${testRunId} address`,
      age: overrides.age ?? null,
      role,
      isActive: overrides.isActive ?? true,
      mustResetPassword: overrides.mustResetPassword ?? false,
      emailVerified: overrides.emailVerified ?? false,
    })
    .returning();

  return user;
}

export async function seedTestTownship(
  db: TestDb,
  overrides: Partial<typeof townships.$inferInsert> = {},
) {
  const [township] = await db
    .insert(townships)
    .values({
      id: overrides.id ?? crypto.randomUUID(),
      name: overrides.name ?? uniqueTestId("township"),
      baseFee: overrides.baseFee ?? 2_000,
      baseWeightKg: overrides.baseWeightKg ?? "3",
      extraWeightFee: overrides.extraWeightFee ?? 500,
      extraWeightUnitKg: overrides.extraWeightUnitKg ?? "1",
      volumetricDivisor: overrides.volumetricDivisor ?? 5000,
      codFeePercent: overrides.codFeePercent ?? "0",
      returnFeePercent: overrides.returnFeePercent ?? "100",
      isActive: overrides.isActive ?? true,
    })
    .returning();

  return township;
}

export async function seedTestMerchant(
  db: TestDb,
  overrides: Partial<typeof merchants.$inferInsert> & { userId?: string } = {},
) {
  const user =
    overrides.userId === undefined ? await seedTestUser(db, { role: "merchant" }) : undefined;
  const [merchant] = await db
    .insert(merchants)
    .values({
      id: overrides.id ?? crypto.randomUUID(),
      userId: overrides.userId ?? user?.id,
      shopName: overrides.shopName ?? uniqueTestId("shop"),
      address: overrides.address ?? `${testRunId} merchant address`,
    })
    .returning();

  return { merchant, user };
}

export async function seedTestRider(
  db: TestDb,
  overrides: Partial<typeof riders.$inferInsert> & { userId?: string; townshipId?: string } = {},
) {
  const user =
    overrides.userId === undefined ? await seedTestUser(db, { role: "rider" }) : undefined;
  const township =
    overrides.townshipId === undefined ? await seedTestTownship(db) : { id: overrides.townshipId };
  const [rider] = await db
    .insert(riders)
    .values({
      id: overrides.id ?? crypto.randomUUID(),
      userId: overrides.userId ?? user?.id,
    })
    .returning();

  const [serviceTownship] = await db
    .insert(riderServiceTownships)
    .values({
      riderId: rider.id,
      townshipId: township.id,
    })
    .returning();

  return { rider, user, township, serviceTownship };
}

export async function seedTestParcel(
  db: TestDb,
  overrides: Partial<typeof parcels.$inferInsert> & {
    merchantId?: string;
    townshipId?: string;
    createdBy?: string;
  } = {},
) {
  const merchantSeed = overrides.merchantId === undefined ? await seedTestMerchant(db) : undefined;
  const township =
    overrides.townshipId === undefined ? await seedTestTownship(db) : { id: overrides.townshipId };
  const creator =
    overrides.createdBy === undefined ? await seedTestUser(db, { role: "super_admin" }) : undefined;
  const merchantId = overrides.merchantId ?? merchantSeed?.merchant.id;
  const townshipId = overrides.townshipId ?? township.id;
  const createdBy = overrides.createdBy ?? creator?.id;

  if (!merchantId || !townshipId || !createdBy) {
    throw new Error("Parcel seed requires merchant, township, and creator IDs.");
  }

  const [parcel] = await db
    .insert(parcels)
    .values({
      id: overrides.id ?? crypto.randomUUID(),
      parcelCode: overrides.parcelCode ?? uniqueTestId("PF").slice(0, 32),
      merchantId,
      townshipId,
      receiverName: overrides.receiverName ?? "Receiver",
      receiverPhoneNumber: overrides.receiverPhoneNumber ?? uniquePhoneNumber(),
      receiverAddress: overrides.receiverAddress ?? `${testRunId} receiver address`,
      parcelType: overrides.parcelType ?? "cod",
      codAmount: overrides.codAmount ?? 10_000,
      deliveryFee: overrides.deliveryFee ?? 2_000,
      weightKg: overrides.weightKg ?? "3",
      status: overrides.status ?? "at_office",
      createdBy,
    })
    .returning();

  return { parcel, merchantSeed, township, creator };
}

export async function seedTestBankAccount(
  db: TestDb,
  overrides: Partial<typeof bankAccounts.$inferInsert> & { userId?: string } = {},
) {
  const user = overrides.userId === undefined ? await seedTestUser(db) : undefined;
  const userId = overrides.userId ?? user?.id;

  if (!userId) {
    throw new Error("Bank account seed requires a user ID.");
  }

  const [bankAccount] = await db
    .insert(bankAccounts)
    .values({
      id: overrides.id ?? crypto.randomUUID(),
      userId,
      bankName: overrides.bankName ?? "Test Bank",
      accountHolderName: overrides.accountHolderName ?? "Test Holder",
      accountNumber: overrides.accountNumber ?? uniquePhoneNumber(),
      isCompanyAccount: overrides.isCompanyAccount ?? false,
      isPrimary: overrides.isPrimary ?? false,
    })
    .returning();

  return { bankAccount, user };
}

function uniquePhoneNumber() {
  return `09${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
}
