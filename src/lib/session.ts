import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import type { UserRole } from "@/lib/domain";

export type CurrentUser = {
  id: string;
  name: string;
  phoneNumber: string;
  role: UserRole;
};

const demoUser: CurrentUser = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "AungHtetPaing",
  phoneNumber: "09000000000",
  role: "super_admin",
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (process.env.NEXT_PUBLIC_DEMO_AUTH === "true" || process.env.NODE_ENV === "development") {
    return demoUser;
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    phoneNumber: "unavailable",
    role: "merchant",
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}
