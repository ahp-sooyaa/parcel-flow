import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { userRoles, type UserRole } from "@/lib/domain";

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

const sessionUserRoleSchema = z.looseObject({
  role: z.enum(userRoles),
  phoneNumber: z.string().optional(),
});

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

  const sessionUserParseResult = sessionUserRoleSchema.safeParse(session.user);

  if (!sessionUserParseResult.success) {
    throw new Error(
      "Authenticated sessions must include a valid Parcel Flow user role before non-demo auth is enabled.",
    );
  }

  const sessionUser = sessionUserParseResult.data;

  return {
    id: session.user.id,
    name: session.user.name,
    phoneNumber: sessionUser.phoneNumber ?? "unavailable",
    role: sessionUser.role,
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}
