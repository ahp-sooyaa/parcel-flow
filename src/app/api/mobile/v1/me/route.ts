import type { MobileMeDto } from "@/features/mobile-api/contract";
import { mobileError, mobileOk } from "@/features/mobile-api/server/response";
import { requireMobileRider } from "@/features/mobile-api/server/session";

export async function GET() {
  let result;

  try {
    result = await requireMobileRider();
  } catch {
    return mobileError(500, "Unable to load your profile.");
  }

  if (!result.ok) {
    return result.response;
  }

  const { rider } = result;
  const me: MobileMeDto = {
    id: rider.id,
    name: rider.name,
    username: rider.username,
    phoneNumber: rider.phoneNumber,
    role: "rider",
    mustResetPassword: rider.mustResetPassword,
  };

  return mobileOk(me, "Profile loaded.");
}
