import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HealthCheck = "ok" | "error";

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await db.execute(sql`select 1`);
    return "ok";
  } catch {
    return "error";
  }
}

export async function GET() {
  const database = await checkDatabase();
  const healthy = database === "ok";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "error",
      checks: {
        database,
      },
    },
    { status: healthy ? 200 : 503 },
  );
}
