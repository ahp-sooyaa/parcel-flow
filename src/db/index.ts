import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getDatabaseUrlEnv } from "@/lib/env";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function initDb() {
    const { DATABASE_URL, DATABASE_POOL_MAX } = getDatabaseUrlEnv();

    const queryClient = postgres(DATABASE_URL, {
        max: DATABASE_POOL_MAX,
        prepare: false,
    });

    dbInstance = drizzle(queryClient, { schema, casing: "snake_case" });

    return dbInstance;
}

export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy(
    {} as ReturnType<typeof drizzle<typeof schema>>,
    {
        get(_target, property) {
            const client = dbInstance ?? initDb();

            return Reflect.get(client, property);
        },
    },
);
export type DbClient = typeof db;
