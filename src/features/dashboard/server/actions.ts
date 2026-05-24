"use server";

import { revalidatePath } from "next/cache";

import { getStorageStats } from "@/features/dashboard/server/dal";
import type { RefreshStorageStatsActionResult } from "@/features/dashboard/server/dto";
import { requireCurrentUser } from "@/lib/session";

export async function refreshStorageStatsAction(): Promise<RefreshStorageStatsActionResult> {
  const actor = await requireCurrentUser();

  if (actor.role !== "super_admin") {
    return {
      ok: false,
      message: "You do not have permission to view storage stats.",
    };
  }

  const stats = await getStorageStats();
  const unavailableRows = stats.rows.filter((row) => row.fetchStatus === "unavailable");

  revalidatePath("/dashboard");

  if (unavailableRows.length === 0) {
    return {
      ok: true,
      message: "Storage stats refreshed.",
      stats,
    };
  }

  return {
    ok: false,
    message:
      unavailableRows.length === stats.rows.length
        ? "Storage providers could not be refreshed."
        : `${unavailableRows.map((row) => row.label).join(" and ")} could not be refreshed.`,
    stats,
  };
}
