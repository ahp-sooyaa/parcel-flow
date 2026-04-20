import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { getDatabaseUrlEnv } from "@/lib/env";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function initDb() {
    const { DATABASE_URL } = getDatabaseUrlEnv();

    const queryClient = postgres(DATABASE_URL, {
        max: 10,
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
