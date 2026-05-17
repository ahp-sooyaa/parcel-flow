import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { userRoles, type UserRole } from "@/lib/domain";

export type CurrentUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  phoneNumber: string;
  address: string;
  age: number | null;
  role: UserRole;
  isActive: boolean;
  mustResetPassword: boolean;
};

const sessionUserRoleSchema = z.looseObject({
  username: z.string(),
  email: z.string(),
  role: z.enum(userRoles),
  phoneNumber: z.string(),
  address: z.string(),
  age: z.number().nullable().optional(),
  isActive: z.boolean(),
  mustResetPassword: z.boolean(),
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  const sessionUserParseResult = sessionUserRoleSchema.safeParse(session.user);

  if (!sessionUserParseResult.success) {
    throw new Error("Authenticated sessions must include a valid Parcel Flow user role.");
  }

  const sessionUser = sessionUserParseResult.data;

  return {
    id: session.user.id,
    name: session.user.name,
    username: sessionUser.username,
    email: sessionUser.email,
    phoneNumber: sessionUser.phoneNumber,
    address: sessionUser.address,
    age: sessionUser.age ?? null,
    role: sessionUser.role,
    isActive: sessionUser.isActive,
    mustResetPassword: sessionUser.mustResetPassword,
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  if (!user.isActive) {
    throw new Error("Account is inactive.");
  }

  return user;
}

export function getRoleLandingPath(role: UserRole) {
  if (role === "super_admin") {
    return "/dashboard";
  }

  if (role === "office_admin") {
    return "/dashboard/parcels";
  }

  if (role === "merchant") {
    return "/dashboard/merchant/parcels";
  }

  return "/dashboard/rider/parcels";
}
