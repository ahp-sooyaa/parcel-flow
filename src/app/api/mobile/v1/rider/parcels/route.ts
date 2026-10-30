import { z } from "zod";

import { mobileRiderParcelTabSchema } from "@/features/mobile-api/contract";
import {
  MOBILE_RIDER_PARCEL_PAGE_SIZE,
  toMobileRiderParcelPage,
} from "@/features/mobile-api/server/parcels";
import { mobileError, mobileOk } from "@/features/mobile-api/server/response";
import { requireMobileRider } from "@/features/mobile-api/server/session";
import { listRiderParcelsPageForUser } from "@/features/parcels/server/dal";

const listQuerySchema = z.object({
  tab: mobileRiderParcelTabSchema.default("to_deliver"),
  page: z.coerce.number().int().min(1).default(1),
});

export async function GET(request: Request) {
  let result;

  try {
    result = await requireMobileRider();
  } catch {
    return mobileError(500, "Unable to load your parcels.");
  }

  if (!result.ok) {
    return result.response;
  }

  const { searchParams } = new URL(request.url);
  // Unlike the web's lenient parser, bad input from the app is a bug, so it's a 400.
  const query = listQuerySchema.safeParse({
    tab: searchParams.get("tab") ?? undefined,
    page: searchParams.get("page") ?? undefined,
  });

  if (!query.success) {
    return mobileError(400, "Invalid parcel list request.");
  }

  try {
    const page = await listRiderParcelsPageForUser(result.rider.id, {
      tab: query.data.tab,
      page: query.data.page,
      pageSize: MOBILE_RIDER_PARCEL_PAGE_SIZE,
      searchTerm: "",
      townshipName: null,
      statuses: [],
    });

    return mobileOk(toMobileRiderParcelPage(page), "Parcels loaded.");
  } catch {
    return mobileError(500, "Unable to load your parcels.");
  }
}
