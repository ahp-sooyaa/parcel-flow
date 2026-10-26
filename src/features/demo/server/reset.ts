import { ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { appUsers } from "@/db/schema";
import {
  getSeededDemoUsernames,
  seedDemoData,
  type DemoSeedSummary,
} from "@/features/demo/server/seed";
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

export class DemoResetRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoResetRefusedError";
  }
}

/**
 * Throws unless this database is safe to wipe: demo mode must be on, and every
 * non-super-admin account must be one the demo seed created. Anything else
 * means real people may be using this database.
 */
export async function assertSafeToResetDemo(options: { force?: boolean } = {}) {
  if (!isDemoMode()) {
    throw new DemoResetRefusedError("Refusing to reset: NEXT_PUBLIC_DEMO_MODE is not enabled.");
  }

  if (options.force) {
    return;
  }

  const seededUsernames = getSeededDemoUsernames();
  const users = await db
    .select({ username: appUsers.username })
    .from(appUsers)
    .where(ne(appUsers.role, "super_admin"));
  const unknownUsernames = users
    .map((user) => user.username)
    .filter((username) => !seededUsernames.has(username));

  if (unknownUsernames.length > 0) {
    throw new DemoResetRefusedError(
      `Refusing to reset: found ${unknownUsernames.length} account(s) the demo seed did not create (${unknownUsernames.slice(0, 5).join(", ")}). Pass --force if this database really is the demo.`,
    );
  }
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
