import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  accounts,
  appUsers,
  bankAccounts,
  merchants,
  parcels,
  riders,
  riderServiceTownships,
  townships,
} from "@/db/schema";
import { auth } from "@/lib/auth";

const smokeRunId = crypto.randomUUID().slice(0, 8);
const merchantPassword = `Smoke-${smokeRunId}-merchant1`;
const riderPassword = `Smoke-${smokeRunId}-rider1`;
const merchantUsername = `smoke-merchant-${smokeRunId}`;
const riderUsername = `smoke-rider-${smokeRunId}`;
const createdIds = {
  merchantUserId: "",
  riderUserId: "",
  merchantId: "",
  riderId: "",
  townshipId: "",
  parcelId: "",
};

async function cleanup() {
  if (createdIds.parcelId) {
    await db.delete(parcels).where(eq(parcels.id, createdIds.parcelId));
  }

  if (createdIds.riderId) {
    await db
      .delete(riderServiceTownships)
      .where(eq(riderServiceTownships.riderId, createdIds.riderId));
    await db.delete(riders).where(eq(riders.id, createdIds.riderId));
  }

  if (createdIds.merchantId) {
    await db.delete(merchants).where(eq(merchants.id, createdIds.merchantId));
  }

  if (createdIds.townshipId) {
    await db.delete(townships).where(eq(townships.id, createdIds.townshipId));
  }

  for (const userId of [createdIds.merchantUserId, createdIds.riderUserId]) {
    if (!userId) {
      continue;
    }

    await db.delete(bankAccounts).where(eq(bankAccounts.userId, userId));
    await db.delete(accounts).where(eq(accounts.userId, userId));
    await db.delete(appUsers).where(eq(appUsers.id, userId));
  }
}

async function main() {
  try {
    const merchantUser = await auth.api.createUser({
      body: {
        name: "Smoke Merchant",
        email: `${merchantUsername}@users.parcel-flow.local`,
        password: merchantPassword,
        role: "merchant",
        data: {
          username: merchantUsername,
          displayUsername: merchantUsername,
          phoneNumber: `09${smokeRunId}001`,
          address: "Smoke merchant address",
          isActive: true,
          mustResetPassword: true,
        },
      },
    });
    createdIds.merchantUserId = merchantUser.user.id;

    const riderUser = await auth.api.createUser({
      body: {
        name: "Smoke Rider",
        email: `${riderUsername}@users.parcel-flow.local`,
        password: riderPassword,
        role: "rider",
        data: {
          username: riderUsername,
          displayUsername: riderUsername,
          phoneNumber: `09${smokeRunId}002`,
          address: "Smoke rider address",
          isActive: true,
          mustResetPassword: true,
        },
      },
    });
    createdIds.riderUserId = riderUser.user.id;

    const signedIn = await auth.api.signInUsername({
      body: {
        username: merchantUsername,
        password: merchantPassword,
      },
    });

    if (signedIn.user.id !== createdIds.merchantUserId) {
      throw new Error("Smoke login returned the wrong user.");
    }

    const [township] = await db
      .insert(townships)
      .values({
        name: `Smoke Township ${smokeRunId}`,
        baseFee: 2500,
      })
      .returning();
    createdIds.townshipId = township.id;

    const [merchant] = await db
      .insert(merchants)
      .values({
        userId: createdIds.merchantUserId,
        shopName: `Smoke Shop ${smokeRunId}`,
        address: "Smoke merchant shop",
      })
      .returning();
    createdIds.merchantId = merchant.id;

    const [rider] = await db.insert(riders).values({ userId: createdIds.riderUserId }).returning();
    createdIds.riderId = rider.id;

    await db.insert(riderServiceTownships).values({
      riderId: createdIds.riderId,
      townshipId: createdIds.townshipId,
    });

    await db.insert(bankAccounts).values({
      userId: createdIds.merchantUserId,
      bankName: "Smoke Bank",
      accountHolderName: "Smoke Merchant",
      accountNumber: `SMOKE${smokeRunId}`,
      isPrimary: true,
    });

    const [parcel] = await db
      .insert(parcels)
      .values({
        parcelCode: `PF-SMOKE-${smokeRunId}`,
        merchantId: createdIds.merchantId,
        townshipId: createdIds.townshipId,
        receiverName: "Smoke Receiver",
        receiverPhoneNumber: `09${smokeRunId}003`,
        receiverAddress: "Smoke receiver address",
        parcelType: "cod",
        codAmount: 10000,
        deliveryFee: 2500,
        status: "at_office",
        codStatus: "pending",
        deliveryFeeStatus: "pending",
        createdBy: createdIds.merchantUserId,
      })
      .returning();
    createdIds.parcelId = parcel.id;

    await db
      .update(parcels)
      .set({
        riderId: createdIds.riderId,
        assignedAt: new Date(),
      })
      .where(eq(parcels.id, createdIds.parcelId));

    const [assignedParcel] = await db
      .select({ riderId: parcels.riderId, status: parcels.status })
      .from(parcels)
      .where(eq(parcels.id, createdIds.parcelId));

    if (assignedParcel?.riderId !== createdIds.riderId || assignedParcel.status !== "at_office") {
      throw new Error("Smoke assignment did not persist expected rider without status change.");
    }

    console.log("database smoke checks passed");
  } finally {
    await cleanup();
  }
}

await main();
process.exit(0);
