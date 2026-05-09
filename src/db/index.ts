import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/parcel_flow";

const client = postgres(databaseUrl, { prepare: false });

export const db = drizzle(client, { schema });
