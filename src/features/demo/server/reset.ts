import { ne } from "drizzle-orm";

import { db } from "@/db";
import { appUsers } from "@/db/schema";
import snapshotData from "@/features/demo/data/snapshot.json";
import { assertDemoResetIsSafe } from "@/features/demo/server/safety";
import {
  demoWipeStatements,
  getSnapshotUsernames,
  loadDemoSnapshot,
  parseDemoSnapshot,
} from "@/features/demo/server/snapshot";
import { isDemoMode } from "@/lib/demo";

export type DemoResetSummary = {
  parcels: number;
  settlements: number;
  riderPayouts: number;
};

const demoSnapshot = parseDemoSnapshot(snapshotData);

export function getSeededDemoUsernames() {
  return getSnapshotUsernames(demoSnapshot);
}

export async function assertSafeToResetDemo(options: { force?: boolean } = {}) {
  const demoMode = isDemoMode();
  const existingUsernames =
    demoMode && !options.force
      ? (
          await db
            .select({ username: appUsers.username })
            .from(appUsers)
            .where(ne(appUsers.role, "super_admin"))
        ).map((user) => user.username)
      : [];

  assertDemoResetIsSafe({
    demoMode,
    force: options.force,
    existingUsernames,
    seededUsernames: getSeededDemoUsernames(),
  });
}

/**
 * Replaces all demo data with the committed snapshot in a single transaction,
 * so visitors see either the old data or the fresh data, never a half-built mix.
 */
export async function resetDemoData(
  options: { force?: boolean; now?: Date } = {},
): Promise<DemoResetSummary> {
  await assertSafeToResetDemo(options);

  await db.transaction(async (tx) => {
    for (const statement of demoWipeStatements) {
      await tx.execute(statement);
    }

    await loadDemoSnapshot(tx, demoSnapshot, options.now ?? new Date());
  });

  return {
    parcels: demoSnapshot.tables.parcels.length,
    settlements: demoSnapshot.tables.merchant_settlements.length,
    riderPayouts: demoSnapshot.tables.rider_payouts.length,
  };
}
