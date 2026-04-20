import { readFile } from "node:fs/promises";
import postgres from "postgres";

function requiredEnv(name: string) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`${name} is required`);
    }

    return value;
}

export async function syncAuthFoundationSeed() {
    const databaseUrl = requiredEnv("DATABASE_URL");
    const sqlText = await readFile("src/db/migrations/0002_seed_data_template.sql", "utf-8");
    const queryClient = postgres(databaseUrl, {
        max: 1,
        prepare: false,
    });

    try {
        await queryClient.unsafe(sqlText);
    } finally {
        await queryClient.end();
    }

    return {
        synced: true,
    };
}
