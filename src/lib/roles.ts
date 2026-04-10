import type { RoleSlug } from "@/db/constants";

export function formatRoleSlug(roleSlug: RoleSlug): string {
  return roleSlug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
