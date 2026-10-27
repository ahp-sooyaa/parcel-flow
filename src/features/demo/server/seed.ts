import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  bankAccounts,
  financialItems,
  merchantSettlements,
  parcelCorrectionLogs,
  parcelStatusLogs,
  parcels,
  riderPayouts,
  riderServiceTownships,
  townships,
} from "@/db/schema";
import {
  assignParcelsToRider,
  correctParcelRider,
  createFinancialItemsFingerprint,
  createParcel,
  markRiderParcelDelivered,
  markRiderParcelReturnedToMerchant,
  reportDeliveryFailureForRiderParcel,
  resolveFailedParcelByAdmin,
  startDeliveryForRiderParcels,
} from "@/features/parcels/server/dal";
import { createRiderPayoutDraft, settleRiderPayout } from "@/features/rider-payouts/server/dal";
import {
  confirmRiderCashHandover,
  createMerchantSettlement,
  resolveMerchantSettlement,
} from "@/features/settlements/server/dal";
import { calculateDeliveryFee } from "@/features/townships/server/utils";
import { createRoleProfile } from "@/features/users/server/dal";
import { buildInternalEmail } from "@/features/users/server/utils";
import { auth } from "@/lib/auth";
import { DEMO_ACCOUNTS, DEMO_ASSET_KEYS, pickDemoProofImageKey } from "@/lib/demo";
import { createSeededRandom } from "@/lib/random";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const RIDER_FEE_PER_WAY = 1_000;
// Matches the production database pool size in src/db/index.ts.
const SEED_CONCURRENCY = 3;

const townshipSeeds = [
  { name: "Kamayut", baseFee: 2_500 },
  { name: "Sanchaung", baseFee: 2_500 },
  { name: "Bahan", baseFee: 2_500 },
  { name: "Yankin", baseFee: 2_500 },
  { name: "Mayangone", baseFee: 3_000 },
  { name: "Hlaing", baseFee: 3_000 },
  { name: "Thingangyun", baseFee: 3_000 },
  { name: "Insein", baseFee: 3_500 },
] as const;

const merchantSeeds = [
  {
    account: DEMO_ACCOUNTS.merchant,
    shopName: "Shwe Thread Boutique",
    phoneNumber: "09250000101",
    address: "No. 45, Bogyoke Aung San Road, Pabedan",
    bankName: "KBZ Bank",
  },
  {
    account: { username: "golden-leaf-tea", name: "Aye Chan Moe", password: "" },
    shopName: "Golden Leaf Tea House",
    phoneNumber: "09250000102",
    address: "No. 12, 35th Street, Kyauktada",
    bankName: "AYA Bank",
  },
] as const;

const riderSeeds = [
  { account: DEMO_ACCOUNTS.rider, phoneNumber: "09250000201" },
  {
    account: { username: "rider-min-thant", name: "Min Thant Kyaw", password: "" },
    phoneNumber: "09250000202",
  },
  {
    account: { username: "rider-soe-moe", name: "Soe Moe Naing", password: "" },
    phoneNumber: "09250000203",
  },
] as const;

const givenNames = [
  "Aung Ko",
  "Su Su",
  "Myo Min",
  "Ei Mon",
  "Thant Zin",
  "Khin Myat",
  "Phyo Wai",
  "May Thu",
  "Nyein Chan",
  "Yamin",
  "Wai Yan",
  "Hsu Lae",
  "Kaung Myat",
  "Thiri",
  "Pyae Sone",
  "Zin Mar",
  "Ye Htut",
  "Moe Moe",
  "Lin Lin",
  "Shwe Yi",
];
const familyNames = [
  "Win",
  "Htun",
  "Oo",
  "Aung",
  "Kyaw",
  "Naing",
  "Lwin",
  "Myint",
  "Hlaing",
  "Soe",
];
const streets = [
  "Pyay Road",
  "Insein Road",
  "Kabar Aye Pagoda Road",
  "University Avenue",
  "Dhammazedi Road",
  "Baho Road",
  "Shwe Gone Daing Road",
  "Thitsar Road",
  "Waizayantar Road",
  "Bayint Naung Road",
];
const failureNotes = [
  "Receiver did not answer the phone after three calls.",
  "Receiver asked to deliver tomorrow evening.",
  "House was locked, neighbour said the receiver is travelling.",
  "Address could not be found, the phone number is switched off.",
  "Receiver refused the parcel, said it was not ordered.",
];
const specialNotes = [
  "Fragile, handle with care.",
  "Call before arriving.",
  "Deliver after 5 PM.",
  "Leave with the security guard if nobody is home.",
];

type SeedPlan =
  | "unassigned"
  | "assigned"
  | "on_the_way"
  | "on_the_way_failed"
  | "delivered"
  | "delivered_handed_over"
  | "postpone"
  | "canceled_returned"
  | "returned_to_merchant";

// A small set (20 parcels) that still shows every status; older parcels are
// further along the flow.
const planCounts: Array<[SeedPlan, number]> = [
  ["delivered_handed_over", 8],
  ["returned_to_merchant", 1],
  ["canceled_returned", 1],
  ["postpone", 1],
  ["delivered", 2],
  ["on_the_way_failed", 1],
  ["on_the_way", 3],
  ["assigned", 1],
  ["unassigned", 2],
];

const maxPlanDaysAgo: Record<SeedPlan, number> = {
  delivered_handed_over: 21,
  returned_to_merchant: 14,
  canceled_returned: 10,
  postpone: 6,
  delivered: 3,
  on_the_way_failed: 1,
  on_the_way: 1,
  assigned: 1,
  unassigned: 1,
};

type SeededUser = { id: string; username: string };

export type DemoSeedSummary = {
  parcels: number;
  settlements: number;
  riderPayouts: number;
};

export async function seedDemoData(options: { now?: Date; seed?: string } = {}) {
  const now = options.now ?? new Date();
  const random = createSeededRandom(options.seed ?? "parcel-flow-demo");
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

  const officeAdmin = await createDemoUser({
    username: DEMO_ACCOUNTS.admin.username,
    name: DEMO_ACCOUNTS.admin.name,
    password: DEMO_ACCOUNTS.admin.password,
    role: "office_admin",
    phoneNumber: "09250000001",
    address: "Parcel Flow office, No. 21, Hledan, Kamayut",
  });

  const townshipRows = await db
    .insert(townships)
    .values(
      townshipSeeds.map((township) => ({
        name: township.name,
        baseFee: township.baseFee,
        baseWeightKg: "3",
        extraWeightFee: 500,
        extraWeightUnitKg: "1",
      })),
    )
    .returning();

  const merchants: Array<{ id: string; userId: string }> = [];

  for (const merchant of merchantSeeds) {
    const user = await createDemoUser({
      username: merchant.account.username,
      name: merchant.account.name,
      password: merchant.account.password || randomPassword(),
      role: "merchant",
      phoneNumber: merchant.phoneNumber,
      address: merchant.address,
    });
    await createRoleProfile({
      userId: user.id,
      role: "merchant",
      shopName: merchant.shopName,
      address: merchant.address,
    });
    await db.insert(bankAccounts).values({
      userId: user.id,
      bankName: merchant.bankName,
      accountHolderName: merchant.account.name,
      accountNumber: `${between(1000, 9999)}${between(100000, 999999)}`,
      isPrimary: true,
    });

    const [row] = await db.execute<{ id: string }>(
      sql`select id from merchants where user_id = ${user.id} limit 1`,
    );
    merchants.push({ id: row.id, userId: user.id });
  }

  const riders: Array<{ id: string; userId: string; townshipIds: Set<string> }> = [];

  for (const [index, rider] of riderSeeds.entries()) {
    const user = await createDemoUser({
      username: rider.account.username,
      name: rider.account.name,
      password: rider.account.password || randomPassword(),
      role: "rider",
      phoneNumber: rider.phoneNumber,
      address: `${pick(streets)}, ${townshipSeeds[index * 2].name}`,
    });
    await createRoleProfile({ userId: user.id, role: "rider", address: "" });
    await db.insert(bankAccounts).values({
      userId: user.id,
      bankName: pick(["KBZ Bank", "AYA Bank", "CB Bank"]),
      accountHolderName: rider.account.name,
      accountNumber: `${between(1000, 9999)}${between(100000, 999999)}`,
      isPrimary: true,
    });

    const [row] = await db.execute<{ id: string }>(
      sql`select id from riders where user_id = ${user.id} limit 1`,
    );
    // Every rider covers a cluster of neighbouring townships, with some overlap.
    // The demo rider covers every township; the others cover a few each.
    const servedTownships = townshipRows.filter(
      (_, townshipIndex) => index === 0 || townshipIndex % riderSeeds.length === index,
    );
    await db
      .insert(riderServiceTownships)
      .values(servedTownships.map((township) => ({ riderId: row.id, townshipId: township.id })));
    riders.push({
      id: row.id,
      userId: user.id,
      townshipIds: new Set(servedTownships.map((township) => township.id)),
    });
  }

  const ridersForTownship = (townshipId: string) => {
    const matches = riders.filter((rider) => rider.townshipIds.has(townshipId));
    return matches.length > 0 ? matches : riders;
  };

  const planned: Array<{ plan: SeedPlan; daysAgo: number }> = [];

  for (const [plan, count] of planCounts) {
    for (let index = 0; index < count; index += 1) {
      planned.push({ plan, daysAgo: random() * maxPlanDaysAgo[plan] });
    }
  }

  // Most parcels go to the demo rider so their queue always has work in it.
  const demoRider = riders[0];
  // Create parcels oldest first so insertion order matches the timeline the
  // settlement and payout slices are cut from.
  planned.sort((left, right) => right.daysAgo - left.daysAgo);

  // Draw every random choice up front, in order, so the data stays
  // deterministic while the database work below runs in parallel.
  const parcelPlans = planned.map((entry, index) => {
    const township = pick(townshipRows);
    const merchant = merchants[index % 2 === 0 ? 0 : between(0, merchants.length - 1)];
    const isCod = random() < 0.8;
    const weightKg = pick([0.5, 1, 1.5, 2, 3, 4, 5, 6]);
    const candidates = ridersForTownship(township.id);

    return {
      entry,
      township,
      merchant,
      isCod,
      weightKg,
      deliveryFee: calculateDeliveryFee(township.baseFee, weightKg, 3, township.extraWeightFee),
      codAmount: isCod ? between(8, 160) * 500 : 0,
      receiverName: `${pick(givenNames)} ${pick(familyNames)}`,
      receiverPhoneNumber: `09${between(400000000, 799999999)}`,
      receiverAddress: `No. ${between(1, 250)}, ${pick(streets)}, ${township.name}`,
      specialNotes: random() < 0.2 ? pick(specialNotes) : undefined,
      desiredCreatedAt: new Date(now.getTime() - entry.daysAgo * DAY_MS - between(0, 8) * HOUR_MS),
      rider: index % 3 !== 2 && candidates.includes(demoRider) ? demoRider : pick(candidates),
      failureNote: pick(failureNotes),
    };
  });

  // The database may be an ocean away from the server, so each step costs a
  // network round trip. Running a few parcels at once keeps the reset short.
  const parcelTargets = await mapWithConcurrency(parcelPlans, SEED_CONCURRENCY, async (plan) => {
    const { entry, rider } = plan;
    const parcel = await createParcel({
      merchantId: plan.merchant.id,
      receiverName: plan.receiverName,
      receiverPhoneNumber: plan.receiverPhoneNumber,
      receiverAddress: plan.receiverAddress,
      specialNotes: plan.specialNotes,
      townshipId: plan.township.id,
      parcelType: plan.isCod ? "cod" : "non_cod",
      codAmount: plan.codAmount,
      deliveryFee: plan.deliveryFee,
      weightKg: plan.weightKg,
      isLargeParcel: plan.weightKg >= 6,
      createdBy: officeAdmin.id,
    });
    const target = { id: parcel.id, desiredCreatedAt: plan.desiredCreatedAt };

    if (entry.plan === "unassigned") {
      return target;
    }

    await assignParcelsToRider({
      parcelIds: [parcel.id],
      riderId: rider.id,
      actorId: officeAdmin.id,
    });

    if (entry.plan === "assigned") {
      return target;
    }

    await startDeliveryForRiderParcels({
      parcelIds: [parcel.id],
      riderUserId: rider.userId,
      actorRole: "rider",
    });

    if (entry.plan === "on_the_way") {
      return target;
    }

    if (entry.plan === "delivered" || entry.plan === "delivered_handed_over") {
      await markRiderParcelDelivered({
        parcelId: parcel.id,
        proofImageKey: pickDemoProofImageKey(parcel.id),
        riderUserId: rider.userId,
        actorRole: "rider",
        createdBy: rider.userId,
      });
      return target;
    }

    await reportDeliveryFailureForRiderParcel({
      parcelId: parcel.id,
      note: plan.failureNote,
      riderUserId: rider.userId,
      actorRole: "rider",
    });

    if (entry.plan === "on_the_way_failed") {
      return target;
    }

    await resolveFailedParcelByAdmin({
      parcelId: parcel.id,
      targetStatus: entry.plan === "postpone" ? "postpone" : "canceled_returned",
      actorId: officeAdmin.id,
      actorRole: "office_admin",
    });

    if (entry.plan === "returned_to_merchant") {
      // Resolving a failure unassigns the rider; the office assigns one for the return trip.
      await assignParcelsToRider({
        parcelIds: [parcel.id],
        riderId: rider.id,
        actorId: officeAdmin.id,
      });
      await markRiderParcelReturnedToMerchant({
        parcelId: parcel.id,
        riderUserId: rider.userId,
        actorRole: "rider",
        createdBy: rider.userId,
      });
    }

    return target;
  });

  await seedRiderCorrections({ riders, actorId: officeAdmin.id });
  await seedCashHandovers({ riders, plannedTargets: parcelTargets, actorId: officeAdmin.id });

  const settlementCount = await seedMerchantSettlements({ merchants, actorId: officeAdmin.id });
  const payoutCount = await seedRiderPayouts({ riders, actorId: officeAdmin.id });

  await backdateParcels(parcelTargets);
  await backdateMoneyRecords(now);

  return {
    parcels: parcelTargets.length,
    settlements: settlementCount,
    riderPayouts: payoutCount,
  } satisfies DemoSeedSummary;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function createDemoUser(input: {
  username: string;
  name: string;
  password: string;
  role: "office_admin" | "merchant" | "rider";
  phoneNumber: string;
  address: string;
}): Promise<SeededUser> {
  const created = await auth.api.createUser({
    body: {
      name: input.name,
      email: buildInternalEmail(input.username),
      password: input.password,
      role: input.role,
      data: {
        username: input.username,
        displayUsername: input.username,
        phoneNumber: input.phoneNumber,
        address: input.address,
        isActive: true,
        mustResetPassword: false,
      },
    },
  });

  return { id: created.user.id, username: input.username };
}

function randomPassword() {
  return `${crypto.randomUUID()}A1`;
}

async function seedRiderCorrections(input: { riders: Array<{ id: string }>; actorId: string }) {
  const assigned = await db
    .select({ id: parcels.id, riderId: parcels.riderId })
    .from(parcels)
    .where(and(eq(parcels.status, "at_office"), sql`${parcels.riderId} is not null`))
    .limit(3);

  for (const parcel of assigned) {
    const targetRider = input.riders.find((rider) => rider.id !== parcel.riderId);

    if (!targetRider) {
      continue;
    }

    await correctParcelRider({
      parcelId: parcel.id,
      expectedStatus: "at_office",
      expectedRiderId: parcel.riderId,
      expectedFinancialItemsFingerprint: createFinancialItemsFingerprint([]),
      targetRiderId: targetRider.id,
      reason: "Original rider called in sick, reassigned to cover the route.",
      actorId: input.actorId,
      actorRole: "office_admin",
    });
  }
}

async function seedCashHandovers(input: {
  riders: Array<{ id: string }>;
  plannedTargets: Array<{ id: string; desiredCreatedAt: Date }>;
  actorId: string;
}) {
  // Only older deliveries have been handed over; the newest stay with the rider.
  const handoverCutoff = Date.now() - 3 * DAY_MS;
  const oldParcelIds = new Set(
    input.plannedTargets
      .filter((target) => target.desiredCreatedAt.getTime() < handoverCutoff)
      .map((target) => target.id),
  );

  for (const rider of input.riders) {
    const delivered = await db
      .select({ id: parcels.id })
      .from(parcels)
      .where(
        and(
          eq(parcels.riderId, rider.id),
          eq(parcels.status, "delivered"),
          eq(parcels.isReceivedByOffice, false),
        ),
      );
    const parcelIds = delivered.map((parcel) => parcel.id).filter((id) => oldParcelIds.has(id));

    if (parcelIds.length > 0) {
      await confirmRiderCashHandover({
        riderId: rider.id,
        parcelIds,
        confirmedBy: input.actorId,
      });
    }
  }
}

/** Eligible settlement items, grouped by parcel, oldest parcel first. */
async function listEligibleSettlementItemsByParcel(merchantId: string) {
  const rows = await db
    .select({ id: financialItems.id, parcelId: financialItems.parcelId })
    .from(financialItems)
    .leftJoin(parcels, eq(parcels.id, financialItems.parcelId))
    .where(
      and(
        eq(financialItems.merchantId, merchantId),
        isNull(financialItems.merchantSettlementId),
        eq(financialItems.status, "pending"),
        or(
          eq(financialItems.itemType, "delivery_fee_deduction"),
          and(eq(financialItems.itemType, "cod_remit"), eq(parcels.isReceivedByOffice, true)),
        ),
      ),
    )
    .orderBy(parcels.createdAt, financialItems.id);
  const itemIdsByParcel = new Map<string, string[]>();

  for (const row of rows) {
    const key = row.parcelId ?? row.id;
    itemIdsByParcel.set(key, [...(itemIdsByParcel.get(key) ?? []), row.id]);
  }

  return [...itemIdsByParcel.values()];
}

async function seedMerchantSettlements(input: {
  merchants: Array<{ id: string }>;
  actorId: string;
}) {
  let count = 0;

  for (const merchant of input.merchants) {
    const parcelItems = await listEligibleSettlementItemsByParcel(merchant.id);

    // Oldest half of the parcels is paid, the next slice waits for payment,
    // the rest stays eligible so visitors can create a settlement themselves.
    const paidCount = Math.ceil(parcelItems.length * 0.5);
    const pendingCount = Math.ceil(parcelItems.length * 0.75) - paidCount;
    const paidSlice = parcelItems.slice(0, paidCount).flat();
    const pendingSlice = parcelItems.slice(paidCount, paidCount + pendingCount).flat();

    for (const [slice, shouldPay] of [
      [paidSlice, true],
      [pendingSlice, false],
    ] as const) {
      if (slice.length === 0) {
        continue;
      }

      const settlement = await tryCreateSettlement(merchant.id, slice, input.actorId);

      if (!settlement) {
        continue;
      }

      count += 1;

      if (shouldPay) {
        await resolveMerchantSettlement({
          settlementId: settlement.id,
          bankTransferReceiptKey: DEMO_ASSET_KEYS.receipt,
          paymentNote: "Paid by bank transfer.",
          paidBy: input.actorId,
        });
      }
    }
  }

  return count;
}

async function tryCreateSettlement(merchantId: string, itemIds: string[], actorId: string) {
  try {
    return await createMerchantSettlement({
      merchantId,
      financialItemIds: itemIds,
      createdBy: actorId,
    });
  } catch (error) {
    // A slice made only of fee deductions has nothing to pay out; skip it.
    console.warn(
      `Skipped a demo settlement: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

async function seedRiderPayouts(input: { riders: Array<{ id: string }>; actorId: string }) {
  let count = 0;

  for (const rider of input.riders) {
    const rows = await db
      .select({ id: financialItems.id })
      .from(financialItems)
      .where(
        and(
          eq(financialItems.riderId, rider.id),
          eq(financialItems.itemType, "rider_way_payout"),
          isNull(financialItems.riderPayoutId),
        ),
      )
      .orderBy(financialItems.createdAt, financialItems.id);
    const itemIds = rows.map((row) => row.id);
    const paidSlice = itemIds.slice(0, Math.floor(itemIds.length * 0.5));
    const draftSlice = itemIds.slice(paidSlice.length, Math.floor(itemIds.length * 0.7));

    if (paidSlice.length > 0) {
      const payout = await createRiderPayoutDraft({
        riderId: rider.id,
        financialItemIds: paidSlice,
        feePerWay: RIDER_FEE_PER_WAY,
        createdBy: input.actorId,
      });
      await settleRiderPayout({
        payoutId: payout.id,
        paymentNote: "Weekly payout.",
        paidBy: input.actorId,
      });
      count += 1;
    }

    if (draftSlice.length > 0) {
      await createRiderPayoutDraft({
        riderId: rider.id,
        financialItemIds: draftSlice,
        feePerWay: RIDER_FEE_PER_WAY,
        createdBy: input.actorId,
      });
      count += 1;
    }
  }

  return count;
}

/**
 * Every parcel was created moments ago. Shift each parcel's timeline, and the
 * logs and financial items that hang off it, back to its planned creation time
 * so the dashboard shows a month of history that ends today.
 */
async function backdateParcels(targets: Array<{ id: string; desiredCreatedAt: Date }>) {
  const ids = targets.map((target) => target.id);
  const actual = await db
    .select({ id: parcels.id, createdAt: parcels.createdAt })
    .from(parcels)
    .where(inArray(parcels.id, ids));
  const actualById = new Map(actual.map((row) => [row.id, row.createdAt.getTime()]));
  const shifts = targets.map((target) => ({
    id: target.id,
    seconds: Math.round(
      ((actualById.get(target.id) ?? 0) - target.desiredCreatedAt.getTime()) / 1000,
    ),
  }));

  // Spread each parcel's steps over a few hours instead of a few milliseconds.
  const shiftValues = sql.join(
    shifts.map((shift) => sql`(${shift.id}::uuid, ${shift.seconds}::int)`),
    sql`, `,
  );
  const shifted = (column: string, extraHours: number) =>
    sql.raw(
      `${column} = case when p.${column} is null then null else least(p.${column} - make_interval(secs => s.seconds) + interval '${extraHours} hours', now()) end`,
    );

  await db.execute(sql`
    update parcels p set
      created_at = p.created_at - make_interval(secs => s.seconds),
      ${shifted("assigned_at", 1)},
      ${shifted("delivered_at", 5)},
      ${shifted("collected_at", 9)},
      ${shifted("returned_to_merchant_at", 30)},
      updated_at = least(p.updated_at - make_interval(secs => s.seconds) + interval '5 hours', now())
    from (values ${shiftValues}) as s(id, seconds)
    where p.id = s.id
  `);

  for (const table of [parcelStatusLogs, parcelCorrectionLogs] as const) {
    await db.execute(sql`
      update ${table} l set created_at = least(l.created_at - make_interval(secs => s.seconds) + interval '3 hours', now())
      from (values ${shiftValues}) as s(id, seconds)
      where l.parcel_id = s.id
    `);
  }

  await db.execute(sql`
    update financial_items f set
      created_at = least(f.created_at - make_interval(secs => s.seconds) + interval '5 hours', now()),
      updated_at = least(f.updated_at - make_interval(secs => s.seconds) + interval '5 hours', now())
    from (values ${shiftValues}) as s(id, seconds)
    where f.parcel_id = s.id
  `);
}

async function backdateMoneyRecords(now: Date) {
  // Settlements and payouts happen after the parcels they cover; place each one
  // just after its newest financial item, and its payment a day after that.
  await db.execute(sql`
    update ${merchantSettlements} m set
      created_at = least(t.newest + interval '1 day', ${now.toISOString()}::timestamptz),
      updated_at = least(t.newest + interval '1 day', ${now.toISOString()}::timestamptz),
      paid_at = case when m.paid_at is null then null else least(t.newest + interval '2 days', ${now.toISOString()}::timestamptz) end,
      bank_transfer_receipt_uploaded_at = case when m.bank_transfer_receipt_uploaded_at is null then null else least(t.newest + interval '2 days', ${now.toISOString()}::timestamptz) end
    from (
      select merchant_settlement_id as id, max(created_at) as newest
      from financial_items where merchant_settlement_id is not null group by merchant_settlement_id
    ) t
    where m.id = t.id
  `);

  await db.execute(sql`
    update ${riderPayouts} r set
      created_at = least(t.newest + interval '1 day', ${now.toISOString()}::timestamptz),
      updated_at = least(t.newest + interval '1 day', ${now.toISOString()}::timestamptz),
      paid_at = case when r.paid_at is null then null else least(t.newest + interval '1 day 2 hours', ${now.toISOString()}::timestamptz) end
    from (
      select rider_payout_id as id, max(created_at) as newest
      from financial_items where rider_payout_id is not null group by rider_payout_id
    ) t
    where r.id = t.id
  `);

  // Codes embed their creation date (MS-YYYYMMDD-xxxxxx); keep that in step.
  await db.execute(sql`
    update ${merchantSettlements} set settlement_code =
      'MS-' || to_char(created_at at time zone 'Asia/Yangon', 'YYYYMMDD') || substring(settlement_code from 12)
  `);
  await db.execute(sql`
    update ${riderPayouts} set payout_code =
      'RP-' || to_char(created_at at time zone 'Asia/Yangon', 'YYYYMMDD') || substring(payout_code from 12)
  `);

  await db.execute(sql`
    update financial_items f set settled_at = coalesce(m.paid_at, r.paid_at)
    from financial_items x
    left join ${merchantSettlements} m on m.id = x.merchant_settlement_id
    left join ${riderPayouts} r on r.id = x.rider_payout_id
    where f.id = x.id and f.settled_at is not null
  `);
}
