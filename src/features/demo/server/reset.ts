import { ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { appUsers } from "@/db/schema";
import {
  getSeededDemoUsernames,
  seedDemoData,
  type DemoSeedSummary,
} from "@/features/demo/server/seed";
import { assertDemoResetIsSafe } from "@/features/demo/server/safety";
import { isDemoMode } from "@/lib/demo";

// Same order as src/db/reset-development-data.ts, but super admins survive so
// the owner's account and password are not reset with the demo data.
const deleteStatements = [
  sql`DELETE FROM financial_items`,
  sql`DELETE FROM parcel_correction_logs`,
  sql`DELETE FROM parcel_status_logs`,
  sql`DELETE FROM parcels`,
  sql`DELETE FROM merchant_settlements`,
  sql`DELETE FROM rider_payouts`,
  sql`DELETE FROM rider_service_townships`,
  sql`DELETE FROM bank_accounts WHERE user_id IN (SELECT id FROM "user" WHERE role <> 'super_admin')`,
  sql`DELETE FROM merchants`,
  sql`DELETE FROM riders`,
  sql`DELETE FROM townships`,
  sql`DELETE FROM session WHERE user_id IN (SELECT id FROM "user" WHERE role <> 'super_admin')`,
  sql`DELETE FROM account WHERE user_id IN (SELECT id FROM "user" WHERE role <> 'super_admin')`,
  sql`DELETE FROM "user" WHERE role <> 'super_admin'`,
  sql`DELETE FROM verification`,
];

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

export async function resetDemoData(
  options: { force?: boolean; now?: Date } = {},
): Promise<DemoSeedSummary> {
  await assertSafeToResetDemo(options);

  await db.transaction(async (tx) => {
    for (const statement of deleteStatements) {
      await tx.execute(statement);
    }
  });

  return seedDemoData({ now: options.now });
}
