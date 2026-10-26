import { sql } from "drizzle-orm";
import { z } from "zod";

import type { db } from "@/db";

type SqlExecutor = Pick<typeof db, "execute">;

export type DemoSnapshotRow = Record<string, unknown>;

/** `generatedAt` is when the snapshot was taken; every timestamp shifts by (now - generatedAt) on load. */
export type DemoSnapshot = z.infer<typeof demoSnapshotSchema>;

// Same order as src/db/reset-development-data.ts, but super admins survive so
// the owner's account and password are not reset with the demo data.
export const demoWipeStatements = [
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

/**
 * Tables in foreign-key order: each table only references tables above it.
 * Only demo rows are captured; super admins and their accounts never are.
 */
export const DEMO_SNAPSHOT_TABLES = [
  "user",
  "account",
  "bank_accounts",
  "townships",
  "merchants",
  "riders",
  "rider_service_townships",
  "merchant_settlements",
  "rider_payouts",
  "parcels",
  "parcel_status_logs",
  "parcel_correction_logs",
  "financial_items",
] as const;

export type DemoSnapshotTable = (typeof DEMO_SNAPSHOT_TABLES)[number];

const captureQueries: Record<DemoSnapshotTable, string> = {
  user: `SELECT * FROM "user" WHERE role <> 'super_admin' ORDER BY created_at, id`,
  account: `SELECT a.* FROM account a JOIN "user" u ON u.id = a.user_id WHERE u.role <> 'super_admin' ORDER BY a.created_at, a.id`,
  bank_accounts: `SELECT b.* FROM bank_accounts b JOIN "user" u ON u.id = b.user_id WHERE u.role <> 'super_admin' ORDER BY b.created_at, b.id`,
  townships: `SELECT * FROM townships ORDER BY created_at, id`,
  merchants: `SELECT * FROM merchants ORDER BY created_at, id`,
  riders: `SELECT * FROM riders ORDER BY created_at, id`,
  rider_service_townships: `SELECT * FROM rider_service_townships ORDER BY created_at, id`,
  merchant_settlements: `SELECT * FROM merchant_settlements ORDER BY created_at, id`,
  rider_payouts: `SELECT * FROM rider_payouts ORDER BY created_at, id`,
  parcels: `SELECT * FROM parcels ORDER BY created_at, id`,
  parcel_status_logs: `SELECT * FROM parcel_status_logs ORDER BY created_at, id`,
  parcel_correction_logs: `SELECT * FROM parcel_correction_logs ORDER BY created_at, id`,
  financial_items: `SELECT * FROM financial_items ORDER BY created_at, id`,
};

export async function captureDemoSnapshot(
  executor: SqlExecutor,
  generatedAt: Date,
): Promise<DemoSnapshot> {
  const tables: Record<string, DemoSnapshotRow[]> = {};

  for (const table of DEMO_SNAPSHOT_TABLES) {
    const rows = await executor.execute<{ row: DemoSnapshotRow }>(
      sql.raw(`SELECT row_to_json(t) AS row FROM (${captureQueries[table]}) t`),
    );
    tables[table] = rows.map((result) => result.row);
  }

  return parseDemoSnapshot({ generatedAt: generatedAt.toISOString(), tables });
}

const snapshotRowsSchema = z.array(z.record(z.string(), z.unknown()));
const demoSnapshotSchema = z.object({
  generatedAt: z.iso.datetime(),
  tables: z.object({
    user: snapshotRowsSchema,
    account: snapshotRowsSchema,
    bank_accounts: snapshotRowsSchema,
    townships: snapshotRowsSchema,
    merchants: snapshotRowsSchema,
    riders: snapshotRowsSchema,
    rider_service_townships: snapshotRowsSchema,
    merchant_settlements: snapshotRowsSchema,
    rider_payouts: snapshotRowsSchema,
    parcels: snapshotRowsSchema,
    parcel_status_logs: snapshotRowsSchema,
    parcel_correction_logs: snapshotRowsSchema,
    financial_items: snapshotRowsSchema,
  }),
});

export function parseDemoSnapshot(value: unknown): DemoSnapshot {
  const result = demoSnapshotSchema.safeParse(value);

  if (!result.success) {
    throw new Error(
      `Demo snapshot is malformed (${result.error.issues[0]?.path.join(".") ?? "root"}). Regenerate it with \`bun run demo:snapshot\`.`,
    );
  }

  return result.data;
}

/** Whole seconds between the snapshot and `now`; added to every timestamp on load. */
export function getSnapshotShiftSeconds(snapshot: Pick<DemoSnapshot, "generatedAt">, now: Date) {
  return Math.round((now.getTime() - new Date(snapshot.generatedAt).getTime()) / 1000);
}

/**
 * Inserts the snapshot with one statement per table, then moves every
 * timestamp forward so the newest records land at `now`. About 20 round trips
 * in total, so a reset stays fast even with the database in another region.
 */
export async function loadDemoSnapshot(executor: SqlExecutor, snapshot: DemoSnapshot, now: Date) {
  for (const table of DEMO_SNAPSHOT_TABLES) {
    const rows = snapshot.tables[table];

    if (rows.length === 0) {
      continue;
    }

    await executor.execute(sql`
      INSERT INTO ${sql.identifier(table)}
      SELECT * FROM json_populate_recordset(NULL::${sql.identifier(table)}, ${JSON.stringify(rows)}::json)
    `);
  }

  const shiftSeconds = getSnapshotShiftSeconds(snapshot, now);
  const timestampColumns = await executor.execute<{ table_name: string; columns: string[] }>(sql`
    SELECT table_name, array_agg(column_name::text) AS columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'timestamp with time zone'
      AND table_name IN (${sql.join(
        DEMO_SNAPSHOT_TABLES.map((table) => sql`${table}`),
        sql`, `,
      )})
    GROUP BY table_name
  `);

  for (const { table_name: table, columns } of timestampColumns) {
    const assignments = sql.join(
      columns.map(
        (column) =>
          sql`${sql.identifier(column)} = ${sql.identifier(column)} + make_interval(secs => ${shiftSeconds})`,
      ),
      sql`, `,
    );
    const demoRowsOnly =
      table === "user"
        ? sql` WHERE role <> 'super_admin'`
        : table === "account" || table === "bank_accounts"
          ? sql` WHERE user_id IN (SELECT id FROM "user" WHERE role <> 'super_admin')`
          : sql``;

    await executor.execute(sql`UPDATE ${sql.identifier(table)} SET ${assignments}${demoRowsOnly}`);
  }

  // Codes embed their creation date (MS-YYYYMMDD-xxxxxx); keep that in step.
  await executor.execute(sql`
    UPDATE merchant_settlements SET settlement_code =
      'MS-' || to_char(created_at AT TIME ZONE 'Asia/Yangon', 'YYYYMMDD') || substring(settlement_code FROM 12)
  `);
  await executor.execute(sql`
    UPDATE rider_payouts SET payout_code =
      'RP-' || to_char(created_at AT TIME ZONE 'Asia/Yangon', 'YYYYMMDD') || substring(payout_code FROM 12)
  `);
}

export function getSnapshotUsernames(snapshot: DemoSnapshot) {
  return new Set(
    snapshot.tables.user.flatMap((row) => (typeof row.username === "string" ? [row.username] : [])),
  );
}
