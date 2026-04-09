import { requireAppAccessContext } from "@/features/auth/server/utils";

import type { PermissionSlug } from "@/db/constants";
import type { ReactNode } from "react";

type IfPermittedProps = {
  permission: PermissionSlug;
  children: ReactNode;
  fallback?: ReactNode;
};

export async function IfPermitted({ permission, children, fallback = null }: IfPermittedProps) {
  let currentUser;
  try {
    currentUser = await requireAppAccessContext();
  } catch {
    return fallback;
  }

  if (!currentUser.permissions.includes(permission)) {
    return fallback;
  }

  return children;
}
