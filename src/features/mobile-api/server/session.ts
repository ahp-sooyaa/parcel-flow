import { mobileError } from "@/features/mobile-api/server/response";
import { getCurrentUser, type CurrentUser } from "@/lib/session";

export type MobileRiderResult =
  | { ok: true; rider: CurrentUser }
  | { ok: false; response: ReturnType<typeof mobileError> };

/**
 * Session gate for `/api/mobile/v1` rider routes. Unlike `requireCurrentUser()`,
 * it tells "not signed in" (401) apart from "signed in but not allowed" (403),
 * so the app knows when to send the rider back to the login screen.
 */
export async function requireMobileRider(): Promise<MobileRiderResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, response: mobileError(401, "Authentication required.") };
  }

  if (!user.isActive) {
    return { ok: false, response: mobileError(403, "Account is inactive.") };
  }

  if (user.role !== "rider") {
    return { ok: false, response: mobileError(403, "The mobile app is only available to riders.") };
  }

  return { ok: true, rider: user };
}
