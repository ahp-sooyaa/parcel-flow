import { existsSync, readFileSync } from "node:fs";
import { PERMISSION_SLUGS, ROLE_PERMISSION_MATRIX } from "@/db/constants";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function verifyPermissionModel() {
  const permissionSet = new Set<string>(PERMISSION_SLUGS);
  const legacyPermissionSlugs = [
    "dashboard.view",
    "users.create",
    "users.read",
    "users.update_status",
    "user:reset_password",
    "profile.view_self",
    "profile.update_self",
    "profile.change_password_self",
    "parcels.read_assigned",
    "merchant_portal.view_self",
  ] as const;

  assert(permissionSet.has("dashboard-page.view"), "Permission dashboard-page.view must exist");
  assert(permissionSet.has("password.change"), "Permission password.change must exist");
  assert(permissionSet.has("user-password.reset"), "Permission user-password.reset must exist");
  for (const legacySlug of legacyPermissionSlugs) {
    assert(!permissionSet.has(legacySlug), `Legacy permission ${legacySlug} must not exist`);
  }

  for (const [role, rolePermissions] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    for (const permission of rolePermissions) {
      assert(
        permissionSet.has(permission),
        `Role ${role} references unknown permission ${permission}`,
      );
    }
  }

  for (const [role, rolePermissions] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    assert(
      rolePermissions.includes("dashboard-page.view"),
      `Role ${role} must include dashboard-page.view`,
    );
    assert(
      rolePermissions.includes("password.change"),
      `Role ${role} must include password.change`,
    );
  }

  const officeAdminPermissions = new Set(ROLE_PERMISSION_MATRIX.office_admin);
  assert(
    !officeAdminPermissions.has("user-password.reset"),
    "office_admin must not have user-password.reset",
  );
  assert(!officeAdminPermissions.has("user.delete"), "office_admin must not have user.delete");
  assert(
    !officeAdminPermissions.has("merchant.delete"),
    "office_admin must not have merchant.delete",
  );
  assert(!officeAdminPermissions.has("rider.delete"), "office_admin must not have rider.delete");
  assert(!officeAdminPermissions.has("parcel.delete"), "office_admin must not have parcel.delete");

  const merchantPermissions = new Set(ROLE_PERMISSION_MATRIX.merchant);
  assert(merchantPermissions.has("merchant.view"), "merchant must have merchant.view");
  assert(
    !merchantPermissions.has("merchant-list.view"),
    "merchant must not have merchant-list.view",
  );
  assert(!merchantPermissions.has("parcel-list.view"), "merchant must not have parcel-list.view");

  const riderPermissions = new Set(ROLE_PERMISSION_MATRIX.rider);
  assert(riderPermissions.has("parcel-list.view"), "rider must have parcel-list.view");
  assert(riderPermissions.has("parcel.view"), "rider must have parcel.view");
  assert(riderPermissions.has("parcel.update"), "rider must have parcel.update");
  assert(!riderPermissions.has("parcel.create"), "rider must not have parcel.create");
  assert(!riderPermissions.has("parcel.delete"), "rider must not have parcel.delete");

  const superAdminPermissions = new Set(ROLE_PERMISSION_MATRIX.super_admin);
  for (const permission of PERMISSION_SLUGS) {
    assert(superAdminPermissions.has(permission), `super_admin must include ${permission}`);
  }
}

function verifyNoPublicSignupRoute() {
  assert(!existsSync("src/app/(auth)/sign-up/page.tsx"), "Public sign-up page must not exist");
}

function verifySharedPermissionCodesExistAcrossRoles() {
  const merchantViewRoles = Object.entries(ROLE_PERMISSION_MATRIX)
    .filter(([, permissions]) => permissions.includes("merchant.view"))
    .map(([role]) => role);

  const parcelUpdateRoles = Object.entries(ROLE_PERMISSION_MATRIX)
    .filter(([, permissions]) => permissions.includes("parcel.update"))
    .map(([role]) => role);

  assert(merchantViewRoles.includes("merchant"), "merchant.view must be assigned to merchant role");
  assert(
    merchantViewRoles.includes("office_admin"),
    "merchant.view must be assigned to office_admin role",
  );
  assert(
    merchantViewRoles.includes("super_admin"),
    "merchant.view must be assigned to super_admin role",
  );

  assert(parcelUpdateRoles.includes("rider"), "parcel.update must be assigned to rider role");
  assert(
    parcelUpdateRoles.includes("office_admin"),
    "parcel.update must be assigned to office_admin role",
  );
  assert(
    parcelUpdateRoles.includes("super_admin"),
    "parcel.update must be assigned to super_admin role",
  );
}

function verifyTemporaryPasswordNotPersisted() {
  const migrationSql = readFileSync(
    "src/db/migrations/0000_auth_authorization_foundation.sql",
    "utf-8",
  );
  const schemaSource = readFileSync("src/db/schema.ts", "utf-8");

  assert(
    !migrationSql.includes("temporary_password"),
    "Database must not define temporary_password column",
  );
  assert(!migrationSql.includes("temp_password"), "Database must not define temp_password column");
  assert(
    !schemaSource.includes('text("temporary_password"'),
    "Schema must not define temporary_password field",
  );
  assert(
    !schemaSource.includes('text("temp_password"'),
    "Schema must not define temp_password field",
  );
}

function main() {
  verifyPermissionModel();
  verifyNoPublicSignupRoute();
  verifySharedPermissionCodesExistAcrossRoles();
  verifyTemporaryPasswordNotPersisted();

  // eslint-disable-next-line no-console
  console.log("Auth foundation verification passed.");
}

main();
