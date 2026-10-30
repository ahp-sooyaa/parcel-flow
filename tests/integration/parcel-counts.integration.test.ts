import { afterEach, describe, expect, test } from "bun:test";

import { adminParcelPageSize, riderParcelPageSize } from "@/features/parcels/server/dto";
import { cleanupTestRecords } from "../fixtures/cleanup";
import { createTestDatabase } from "../fixtures/db";
import { seedTestParcel, seedTestRider } from "../fixtures/seed";

const seededIds = {
  userIds: [] as string[],
  merchantIds: [] as string[],
  riderIds: [] as string[],
  townshipIds: [] as string[],
  parcelIds: [] as string[],
};

// postgres-js returns bigint aggregates such as count(*) as strings; the DAL
// must map them to numbers so the declared DTO types hold at runtime.
describe("parcel DAL counts integration", () => {
  const testDb = createTestDatabase();

  afterEach(async () => {
    await cleanupTestRecords(testDb.db, seededIds);
    seededIds.userIds = [];
    seededIds.merchantIds = [];
    seededIds.riderIds = [];
    seededIds.townshipIds = [];
    seededIds.parcelIds = [];
  });

  test("returns rider page, admin page, and summary counts as numbers", async () => {
    const riderSeed = await seedTestRider(testDb.db);
    const parcelSeed = await seedTestParcel(testDb.db, {
      riderId: riderSeed.rider.id,
      status: "on_the_way",
      assignedAt: new Date(),
    });
    seededIds.userIds.push(
      ...[riderSeed.user?.id, parcelSeed.merchantSeed?.user?.id, parcelSeed.creator?.id].filter(
        (id): id is string => Boolean(id),
      ),
    );
    seededIds.riderIds.push(riderSeed.rider.id);
    seededIds.townshipIds.push(riderSeed.township.id, parcelSeed.township.id);
    seededIds.merchantIds.push(parcelSeed.merchantSeed?.merchant.id ?? "");
    seededIds.parcelIds.push(parcelSeed.parcel.id);

    const { getParcelSummary, listAdminParcelsPage, listRiderParcelsPageForUser } =
      await import("@/features/parcels/server/dal");

    const riderPage = await listRiderParcelsPageForUser(riderSeed.user?.id ?? "", {
      searchTerm: "",
      tab: "to_deliver",
      townshipName: null,
      statuses: [],
      page: 1,
      pageSize: riderParcelPageSize,
    });
    const adminPage = await listAdminParcelsPage({
      searchTerm: "",
      assignment: "all",
      townshipName: null,
      statuses: [],
      page: 1,
      pageSize: adminParcelPageSize,
    });
    const summary = await getParcelSummary();

    expect(riderPage.totalCount).toBe(1);
    expect(riderPage.tabCounts).toEqual({ to_deliver: 1, delivered: 0, returned: 0 });
    expect(typeof adminPage.totalCount).toBe("number");
    expect(adminPage.totalCount).toBeGreaterThanOrEqual(1);

    const counts = {
      riderTotalCount: riderPage.totalCount,
      ...Object.fromEntries(
        Object.entries(riderPage.tabCounts).map(([tab, count]) => [`riderTab.${tab}`, count]),
      ),
      ...Object.fromEntries(
        Object.entries(adminPage.assignmentCounts).map(([key, count]) => [`admin.${key}`, count]),
      ),
      ...Object.fromEntries(
        Object.entries(summary).map(([key, count]) => [`summary.${key}`, count]),
      ),
    };

    for (const [name, value] of Object.entries(counts)) {
      expect({ name, type: typeof value }).toEqual({ name, type: "number" });
    }
  });
});
