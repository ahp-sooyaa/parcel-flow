import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import { db } from "@/db";
import {
  accounts,
  appUsers,
  merchants,
  parcels,
  riders,
  riderServiceTownships,
  townships,
} from "@/db/schema";
import { buildInternalEmail, normalizePhoneNumber } from "@/features/users/server/utils";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/lib/domain";

type SeedUserConfig = {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  phoneNumber: string;
  address: string;
};

const townshipName = process.env.E2E_TOWNSHIP_NAME ?? "E2E Seed Township";
const merchantShopName = process.env.E2E_MERCHANT_SHOP_NAME ?? "E2E Merchant Shop";
const seedParcelCode = process.env.E2E_SEED_PARCEL_CODE ?? "PF-E2E-SEED-001";
const assignedParcelCode = process.env.E2E_ASSIGNED_PARCEL_CODE ?? "PF-E2E-SEED-002";

assertRequiredEnv("DATABASE_URL");
assertRequiredEnv("BETTER_AUTH_URL");
assertRequiredEnv("BETTER_AUTH_SECRET");

const seedUsers: SeedUserConfig[] = [
  {
    username: process.env.E2E_SUPER_ADMIN_USERNAME ?? "e2e-super-admin",
    password: process.env.E2E_SUPER_ADMIN_PASSWORD ?? "password123",
    name: "E2E Super Admin",
    role: "super_admin",
    phoneNumber: "09910000001",
    address: "E2E super admin address",
  },
  {
    username: process.env.E2E_OFFICE_ADMIN_USERNAME ?? "e2e-office-admin",
    password: process.env.E2E_OFFICE_ADMIN_PASSWORD ?? "password123",
    name: "E2E Office Admin",
    role: "office_admin",
    phoneNumber: "09910000002",
    address: "E2E office admin address",
  },
  {
    username: process.env.E2E_MERCHANT_USERNAME ?? "e2e-merchant",
    password: process.env.E2E_MERCHANT_PASSWORD ?? "password123",
    name: "E2E Merchant",
    role: "merchant",
    phoneNumber: "09910000003",
    address: "E2E merchant address",
  },
  {
    username: process.env.E2E_RIDER_USERNAME ?? "e2e-rider",
    password: process.env.E2E_RIDER_PASSWORD ?? "password123",
    name: "E2E Rider",
    role: "rider",
    phoneNumber: "09910000004",
    address: "E2E rider address",
  },
];

async function main() {
  const [superAdmin, _officeAdmin, merchantUser, riderUser] = await Promise.all(
    seedUsers.map(seedE2eUser),
  );
  const township = await upsertTownship();
  const merchant = await upsertMerchantProfile(merchantUser.id);
  const rider = await upsertRiderProfile(riderUser.id, township.id);
  await upsertSeedParcel({
    parcelCode: seedParcelCode,
    merchantId: merchant.id,
    townshipId: township.id,
    createdBy: superAdmin.id,
    receiverName: "E2E Assignment Receiver",
    riderId: null,
  });
  await upsertSeedParcel({
    parcelCode: assignedParcelCode,
    merchantId: merchant.id,
    townshipId: township.id,
    createdBy: superAdmin.id,
    receiverName: "E2E Rider Receiver",
    riderId: rider.id,
  });

  console.log("Seeded E2E users and baseline records.");
  console.log(`Super admin: ${seedUsers[0]?.username}`);
  console.log(`Office admin: ${seedUsers[1]?.username}`);
  console.log(`Merchant: ${seedUsers[2]?.username}`);
  console.log(`Rider: ${seedUsers[3]?.username}`);
}

async function seedE2eUser(config: SeedUserConfig) {
  const [existingUser] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.username, config.username))
    .limit(1);

  if (existingUser) {
    await db
      .update(appUsers)
      .set({
        name: config.name,
        email: buildInternalEmail(config.username),
        phoneNumber: normalizePhoneNumber(config.phoneNumber),
        address: config.address,
        role: config.role,
        isActive: true,
        mustResetPassword: false,
        updatedAt: new Date(),
      })
      .where(eq(appUsers.id, existingUser.id));

    await upsertCredentialPassword(existingUser.id, config.password);

    return {
      ...existingUser,
      role: config.role,
    };
  }

  const createdUser = await auth.api.createUser({
    body: {
      name: config.name,
      email: buildInternalEmail(config.username),
      password: config.password,
      role: config.role,
      data: {
        username: config.username,
        displayUsername: config.username,
        phoneNumber: normalizePhoneNumber(config.phoneNumber),
        address: config.address,
        age: null,
        isActive: true,
        mustResetPassword: false,
      },
    },
  });

  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.id, createdUser.user.id))
    .limit(1);

  if (!user) {
    throw new Error(`Created E2E user "${config.username}" could not be loaded.`);
  }

  return user;
}

async function upsertCredentialPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);

  if (existingAccount) {
    await db
      .update(accounts)
      .set({
        accountId: userId,
        password: passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, existingAccount.id));

    return;
  }

  await db.insert(accounts).values({
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
  });
}

async function upsertTownship() {
  const values = {
    name: townshipName,
    baseFee: 2_000,
    baseWeightKg: "3",
    extraWeightFee: 500,
    extraWeightUnitKg: "1",
    volumetricDivisor: 5000,
    codFeePercent: "0",
    returnFeePercent: "100",
    isActive: true,
    updatedAt: new Date(),
  };
  const [existingTownship] = await db
    .select()
    .from(townships)
    .where(eq(townships.name, townshipName))
    .limit(1);

  if (existingTownship) {
    const [township] = await db
      .update(townships)
      .set(values)
      .where(eq(townships.id, existingTownship.id))
      .returning();

    return township;
  }

  const [township] = await db.insert(townships).values(values).returning();

  return township;
}

async function upsertMerchantProfile(userId: string) {
  const [existingMerchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.userId, userId))
    .limit(1);

  if (existingMerchant) {
    const [merchant] = await db
      .update(merchants)
      .set({
        shopName: merchantShopName,
        address: "E2E merchant shop address",
        updatedAt: new Date(),
      })
      .where(eq(merchants.id, existingMerchant.id))
      .returning();

    return merchant;
  }

  const [merchant] = await db
    .insert(merchants)
    .values({
      userId,
      shopName: merchantShopName,
      address: "E2E merchant shop address",
    })
    .returning();

  return merchant;
}

async function upsertRiderProfile(userId: string, townshipId: string) {
  const [existingRider] = await db.select().from(riders).where(eq(riders.userId, userId)).limit(1);
  const rider =
    existingRider ?? (await db.insert(riders).values({ userId }).returning()).at(0);

  if (!rider) {
    throw new Error("Unable to seed E2E rider profile.");
  }

  const [existingServiceTownship] = await db
    .select()
    .from(riderServiceTownships)
    .where(
      and(
        eq(riderServiceTownships.riderId, rider.id),
        eq(riderServiceTownships.townshipId, townshipId),
      ),
    )
    .limit(1);

  if (!existingServiceTownship) {
    await db.insert(riderServiceTownships).values({
      riderId: rider.id,
      townshipId,
    });
  }

  return rider;
}

async function upsertSeedParcel(input: {
  parcelCode: string;
  merchantId: string;
  townshipId: string;
  createdBy: string;
  receiverName: string;
  riderId: string | null;
}) {
  const values = {
    merchantId: input.merchantId,
    riderId: input.riderId,
    townshipId: input.townshipId,
    receiverName: input.receiverName,
    receiverPhoneNumber: "09910000005",
    receiverAddress: "E2E receiver address",
    parcelType: "cod",
    codAmount: 10_000,
    deliveryFee: 2_000,
    weightKg: "3",
    status: "at_office",
    codStatus: "pending",
    deliveryFeeStatus: "pending",
    isReceivedByOffice: false,
    merchantSettlementStatus: "pending",
    riderPayoutStatus: "pending",
    createdBy: input.createdBy,
    assignedAt: input.riderId ? new Date() : null,
    updatedAt: new Date(),
  };
  const [existingParcel] = await db
    .select()
    .from(parcels)
    .where(eq(parcels.parcelCode, input.parcelCode))
    .limit(1);

  if (existingParcel) {
    const [parcel] = await db
      .update(parcels)
      .set(values)
      .where(eq(parcels.id, existingParcel.id))
      .returning();

    return parcel;
  }

  const [parcel] = await db
    .insert(parcels)
    .values({
      ...values,
      parcelCode: input.parcelCode,
    })
    .returning();

  return parcel;
}

function assertRequiredEnv(name: string) {
  if (!process.env[name]?.trim()) {
    throw new Error(`${name} is required for E2E seeding.`);
  }
}

await main();
process.exit(0);
