import { mock } from "bun:test";

// The DAL imports Next's cache APIs, which need a Next request context.
void mock.module("next/cache", () => ({
  cacheLife: () => undefined,
  cacheTag: () => undefined,
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  updateTag: () => undefined,
}));

const { writeFile } = await import("node:fs/promises");
const { closeDatabase, db } = await import("@/db");
const { seedDemoData } = await import("@/features/demo/server/seed");
const { captureDemoSnapshot, demoWipeStatements } = await import("@/features/demo/server/snapshot");

const SNAPSHOT_PATH = new URL("../features/demo/data/snapshot.json", import.meta.url);

/**
 * Regenerates src/features/demo/data/snapshot.json. It runs the full demo seed
 * through the real DAL against a local database (fast, no network round
 * trips), then saves the rows. Rerun it after schema or seed changes.
 */
function assertLocalDatabase(databaseUrl: string) {
  const { hostname } = new URL(databaseUrl);

  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(
      `Refusing to build the demo snapshot against ${hostname}. It wipes the database, so point DATABASE_URL at a local one (e.g. bun --env-file=.env.test).`,
    );
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  assertLocalDatabase(databaseUrl);

  const generatedAt = new Date();

  await db.transaction(async (tx) => {
    for (const statement of demoWipeStatements) {
      await tx.execute(statement);
    }
  });

  const summary = await seedDemoData({ now: generatedAt });
  const snapshot = await captureDemoSnapshot(db, generatedAt);

  await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `Wrote demo snapshot: ${summary.parcels} parcels, ${summary.settlements} settlements, ${summary.riderPayouts} rider payouts.`,
  );
}

try {
  await main();
} finally {
  await closeDatabase();
}

process.exit(0);
