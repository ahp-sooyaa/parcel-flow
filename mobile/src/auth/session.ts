import { queryClient } from "@/api/query-client";
import { authClient } from "@/auth/client";

/**
 * Ends the session on the server when it can, then always forgets it on the
 * device and drops cached rider data. The auth gate then shows sign in.
 */
export async function signOutRider() {
  try {
    await authClient.signOut();
  } catch {
    // Offline or the server already dropped the session; local cleanup still matters.
  }

  queryClient.clear();
}
