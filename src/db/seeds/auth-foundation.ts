import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { PERMISSION_SLUGS, ROLE_PERMISSION_MATRIX, ROLE_SLUGS } from "@/db/constants";
import { permissions, rolePermissions, roles } from "@/db/schema";

const ROLE_LABELS: Record<(typeof ROLE_SLUGS)[number], string> = {
  super_admin: "Super Admin",
  office_admin: "Office Admin",
  rider: "Rider",
  merchant: "Merchant",
};

const PERMISSION_LABELS: Record<(typeof PERMISSION_SLUGS)[number], string> = {
  "dashboard-page.view": "View dashboard page",
  "password.change": "Change own password",
  "user-password.reset": "Reset user password",
  "user-list.view": "View user list",
  "user.view": "View user details",
  "user.create": "Create user",
  "user.update": "Update user",
  "user.delete": "Delete user",
  "merchant-list.view": "View merchant list",
  "merchant.view": "View merchant details",
  "merchant.create": "Create merchant",
  "merchant.update": "Update merchant",
  "merchant.delete": "Delete merchant",
  "rider-list.view": "View rider list",
  "rider.view": "View rider details",
  "rider.create": "Create rider",
  "rider.update": "Update rider",
  "rider.delete": "Delete rider",
  "parcel-list.view": "View parcel list",
  "parcel.view": "View parcel details",
  "parcel.create": "Create parcel",
  "parcel.update": "Update parcel",
  "parcel.delete": "Delete parcel",
};

export async function seedAuthFoundation() {
  // Remove legacy permission rows so role assignments cannot inherit stale slugs.
  await db.delete(permissions).where(notInArray(permissions.slug, [...PERMISSION_SLUGS]));

  for (const roleSlug of ROLE_SLUGS) {
    await db
      .insert(roles)
      .values({
        slug: roleSlug,
        label: ROLE_LABELS[roleSlug],
      })
      .onConflictDoUpdate({
        target: roles.slug,
        set: {
          label: ROLE_LABELS[roleSlug],
        },
      });
  }

  for (const permissionSlug of PERMISSION_SLUGS) {
    await db
      .insert(permissions)
      .values({
        slug: permissionSlug,
        label: PERMISSION_LABELS[permissionSlug],
      })
      .onConflictDoUpdate({
        target: permissions.slug,
        set: {
          label: PERMISSION_LABELS[permissionSlug],
        },
      });
  }

  const roleRows = await db.select().from(roles);
  const permissionRows = await db.select().from(permissions);

  const roleBySlug = new Map(roleRows.map((role) => [role.slug, role]));
  const permissionBySlug = new Map(
    permissionRows.map((permission) => [permission.slug, permission]),
  );

  const desiredPermissionIdsByRole = new Map<string, string[]>();

  for (const roleSlug of ROLE_SLUGS) {
    const role = roleBySlug.get(roleSlug);

    if (!role) {
      throw new Error(`Missing role seed row for ${roleSlug}`);
    }

    const desiredPermissionIds = ROLE_PERMISSION_MATRIX[roleSlug].map((permissionSlug) => {
      const permission = permissionBySlug.get(permissionSlug);

      if (!permission) {
        throw new Error(`Missing permission seed row for ${permissionSlug}`);
      }

      return permission.id;
    });

    desiredPermissionIdsByRole.set(role.id, desiredPermissionIds);
  }

  // Keep super_admin complete in case permissions were added over time.
  const superAdminRole = roleBySlug.get("super_admin");
  if (superAdminRole) {
    desiredPermissionIdsByRole.set(
      superAdminRole.id,
      permissionRows.map((permission) => permission.id),
    );
  }

  for (const [roleId, desiredPermissionIds] of desiredPermissionIdsByRole.entries()) {
    if (desiredPermissionIds.length === 0) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      continue;
    }

    await db
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          notInArray(rolePermissions.permissionId, desiredPermissionIds),
        ),
      );

    const existingRows = await db
      .select({ permissionId: rolePermissions.permissionId })
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          inArray(rolePermissions.permissionId, desiredPermissionIds),
        ),
      );

    const existingPermissionIds = new Set(existingRows.map((row) => row.permissionId));
    const missingPermissionIds = desiredPermissionIds.filter(
      (permissionId) => !existingPermissionIds.has(permissionId),
    );

    if (missingPermissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        missingPermissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      );
    }
  }

  return {
    roles: roleRows.length,
    permissions: permissionRows.length,
  };
}

export async function getRoleBySlug(slug: (typeof ROLE_SLUGS)[number]) {
  const [role] = await db.select().from(roles).where(eq(roles.slug, slug)).limit(1);

  return role ?? null;
}
