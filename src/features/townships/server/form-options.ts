import { cacheLife, cacheTag } from "next/cache";

import { listTownships } from "@/features/townships/server/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";

export async function getTownshipFormOptions() {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.townships);

  return listTownships();
}
