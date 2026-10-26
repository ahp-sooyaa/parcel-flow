import { describe, expect, test } from "bun:test";

import snapshotData from "@/features/demo/data/snapshot.json";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { parcelStatuses } from "@/lib/domain";

const { DEMO_SNAPSHOT_TABLES, getSnapshotShiftSeconds, getSnapshotUsernames, parseDemoSnapshot } =
  await import("@/features/demo/server/snapshot");

describe("demo snapshot", () => {
  const snapshot = parseDemoSnapshot(snapshotData);

  test("has every table and no super admins", () => {
    for (const table of DEMO_SNAPSHOT_TABLES) {
      expect(Array.isArray(snapshot.tables[table])).toBe(true);
    }
    expect(snapshot.tables.user.some((row) => row.role === "super_admin")).toBe(false);
  });

  test("includes the three demo login accounts", () => {
    const usernames = getSnapshotUsernames(snapshot);

    for (const account of Object.values(DEMO_ACCOUNTS)) {
      expect(usernames.has(account.username)).toBe(true);
    }
  });

  test("covers every parcel status with a small data set", () => {
    const statuses = new Set(snapshot.tables.parcels.map((row) => row.status));

    for (const status of parcelStatuses) {
      expect(statuses.has(status)).toBe(true);
    }
    expect(snapshot.tables.parcels.length).toBeLessThanOrEqual(30);
  });

  test("shifts timestamps by the time since the snapshot was taken", () => {
    const generatedAt = new Date(snapshot.generatedAt);
    const threeDaysLater = new Date(generatedAt.getTime() + 3 * 24 * 60 * 60 * 1000);

    expect(getSnapshotShiftSeconds(snapshot, generatedAt)).toBe(0);
    expect(getSnapshotShiftSeconds(snapshot, threeDaysLater)).toBe(3 * 24 * 60 * 60);
  });

  test("rejects a malformed snapshot", () => {
    expect(() => parseDemoSnapshot({ generatedAt: "x", tables: {} })).toThrow("Regenerate");
    expect(() => parseDemoSnapshot(null)).toThrow("malformed");
  });
});
