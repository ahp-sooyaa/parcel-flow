import { mock } from "bun:test";

// The DAL imports Next's cache APIs, which need a Next request context. This
// script runs outside Next, and the reset route revalidates caches itself.
void mock.module("next/cache", () => ({
  cacheLife: () => undefined,
  cacheTag: () => undefined,
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
  updateTag: () => undefined,
}));

const { closeDatabase } = await import("@/db");
const { resetDemoData } = await import("@/features/demo/server/reset");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const force = process.argv.includes("--force");
  const startedAt = Date.now();

  console.log(`Resetting demo data${force ? " (forced)" : ""}...`);
  const summary = await resetDemoData({ force });
  console.log(
    `Demo data ready in ${Math.round((Date.now() - startedAt) / 1000)}s: ${summary.parcels} parcels, ${summary.settlements} settlements, ${summary.riderPayouts} rider payouts.`,
  );
  console.log(
    "Running servers keep cached pages until they expire. Use the /api/demo/reset route to reset and refresh caches together.",
  );
}

try {
  await main();
} finally {
  await closeDatabase();
}

process.exit(0);
