import type { PermissionSlug, RoleSlug } from "@/db/constants";
import type { CurrentUserContext } from "@/features/auth/server/dto";
import type { AccessContext } from "@/lib/auth/route-access";

type E2EAuthHeader = {
  authenticated: boolean;
  isActive: boolean;
  mustResetPassword: boolean;
  permissions: string[];
  roleSlug?: RoleSlug;
};

const roleLabelBySlug: Record<RoleSlug, string> = {
  super_admin: "Super Admin",
  office_admin: "Office Admin",
  rider: "Rider",
  merchant: "Merchant",
};

export function createAccessContext(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    isActive: true,
    mustResetPassword: false,
    permissions: [],
    ...overrides,
  };
}

export function createCurrentUserContext(
  overrides: Partial<CurrentUserContext> = {},
): CurrentUserContext {
  const roleSlug = overrides.role?.slug ?? "office_admin";

  return {
    appUserId: "app-1",
    supabaseUserId: "sup-1",
    fullName: "Test User",
    email: "user@example.com",
    phoneNumber: null,
    isActive: true,
    mustResetPassword: false,
    role: {
      id: overrides.role?.id ?? `role-${roleSlug}`,
      slug: roleSlug,
      label: overrides.role?.label ?? roleLabelBySlug[roleSlug],
    },
    permissions: (overrides.permissions ?? []) as PermissionSlug[],
    ...overrides,
  };
}

export function createE2EAuthHeader(overrides: Partial<E2EAuthHeader> = {}): E2EAuthHeader {
  return {
    authenticated: true,
    isActive: true,
    mustResetPassword: false,
    permissions: [],
    roleSlug: "office_admin",
    ...overrides,
  };
}
