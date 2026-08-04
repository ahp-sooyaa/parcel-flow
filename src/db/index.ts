import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/parcel_flow";

const globalForDb = globalThis as typeof globalThis & {
  parcelFlowPostgres?: ReturnType<typeof postgres>;
};

function createClient() {
  const isDev = process.env.NODE_ENV === "development";

  return postgres(databaseUrl, {
    prepare: false,
    // Supabase free session pooler allows ~15 clients total. Cap the app pool
    // so local Next.js and Railway can share the same project without
    // EMAXCONNSESSION. Keep a singleton in globalThis to avoid Turbopack HMR
    // spawning extra pools that never close.
    max: isDev ? 1 : 3,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
  });
}

const client = globalForDb.parcelFlowPostgres ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.parcelFlowPostgres = client;
}

export const db = drizzle(client, { schema });

export async function closeDatabase() {
  await client.end({ timeout: 5 });

  if (globalForDb.parcelFlowPostgres === client) {
    delete globalForDb.parcelFlowPostgres;
  }
}
