import { sql } from "drizzle-orm";

import { db } from "@/db";

const deleteStatements = [
  sql`DELETE FROM financial_items`,
  sql`DELETE FROM parcel_correction_logs`,
  sql`DELETE FROM parcel_status_logs`,
  sql`DELETE FROM parcels`,
  sql`DELETE FROM merchant_settlements`,
  sql`DELETE FROM rider_payouts`,
  sql`DELETE FROM rider_service_townships`,
  sql`DELETE FROM bank_accounts`,
  sql`DELETE FROM merchants`,
  sql`DELETE FROM riders`,
  sql`DELETE FROM townships`,
  sql`DELETE FROM session`,
  sql`DELETE FROM account`,
  sql`DELETE FROM "user"`,
  sql`DELETE FROM verification`,
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  console.log("Resetting all application data...");

  await db.transaction(async (tx) => {
    for (const statement of deleteStatements) {
      await tx.execute(statement);
    }
  });

  console.log("Application data reset complete.");
}

await main();
process.exit(0);
