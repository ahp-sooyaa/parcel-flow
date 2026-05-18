import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

export type TestDatabase = ReturnType<typeof createTestDatabase>["db"];

const allowedNameFragments = ["test", "ci"];

export function getTestDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database-backed tests.");
  }

  assertSafeTestDatabaseUrl(databaseUrl);

  return databaseUrl;
}

export function assertSafeTestDatabaseUrl(databaseUrl: string) {
  const parsedUrl = new URL(databaseUrl);
  const databaseName = parsedUrl.pathname.replace("/", "").toLowerCase();
  const isLocalSupabaseDatabase =
    (parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost") &&
    parsedUrl.port === "54322" &&
    databaseName === "postgres";

  if (isLocalSupabaseDatabase) {
    return;
  }

  if (!allowedNameFragments.some((fragment) => databaseName.includes(fragment))) {
    throw new Error(
      `Refusing to run integration tests against database "${databaseName}". Use a database name containing "test" or "ci".`,
    );
  }
}

export function createTestDatabase() {
  const client = postgres(getTestDatabaseUrl(), {
    max: 1,
    prepare: false,
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
}

export async function closeTestDatabase(client: postgres.Sql) {
  await client.end();
}
