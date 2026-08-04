import { cacheLife, cacheTag } from "next/cache";

import { listTownships } from "@/features/townships/server/dal";

export async function getTownshipFormOptions() {
  "use cache";
  cacheLife("minutes");
  cacheTag("townships");

  return listTownships();
}
