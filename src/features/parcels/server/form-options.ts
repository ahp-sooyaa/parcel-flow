import { cacheLife, cacheTag } from "next/cache";

import { listMerchantOptions } from "@/features/merchants/server/dal";
import { listTownships } from "@/features/townships/server/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";

export async function getCreateParcelFormOptions() {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.merchantOptions, CACHE_TAGS.townships);

  const [merchants, townships] = await Promise.all([listMerchantOptions(), listTownships()]);

  return { merchants, townships };
}
