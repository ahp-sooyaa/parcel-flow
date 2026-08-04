import { cacheLife, cacheTag } from "next/cache";

import { listMerchantOptions } from "@/features/merchants/server/dal";
import { listTownships } from "@/features/townships/server/dal";

export async function getCreateParcelFormOptions() {
  "use cache";
  cacheLife("minutes");
  cacheTag("merchant-options", "townships");

  const [merchants, townships] = await Promise.all([listMerchantOptions(), listTownships()]);

  return { merchants, townships };
}
