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
        const rolePermissionSet = new Set(rolePermissions);

        assert(
            rolePermissionSet.has("dashboard-page.view"),
            `Role ${role} must include dashboard-page.view`,
        );
    }

    const officeAdminPermissions = new Set(ROLE_PERMISSION_MATRIX.office_admin);
    assert(
        !officeAdminPermissions.has("user-password.reset"),
        "office_admin must not have user-password.reset",
    );
    assert(!officeAdminPermissions.has("user.delete"), "office_admin must not have user.delete");
    assert(
        !officeAdminPermissions.has("township.create"),
        "office_admin must not have township.create",
    );
    assert(
        !officeAdminPermissions.has("township.delete"),
        "office_admin must not have township.delete",
    );
    assert(
        !officeAdminPermissions.has("merchant.delete"),
        "office_admin must not have merchant.delete",
    );
    assert(!officeAdminPermissions.has("rider.delete"), "office_admin must not have rider.delete");
    assert(
        officeAdminPermissions.has("bank-account.view"),
        "office_admin must have bank-account.view",
    );
    assert(
        !officeAdminPermissions.has("bank-account.create"),
        "office_admin must not have bank-account.create",
    );
    assert(
        !officeAdminPermissions.has("bank-account.update"),
        "office_admin must not have bank-account.update",
    );
    assert(
        !officeAdminPermissions.has("bank-account.delete"),
        "office_admin must not have bank-account.delete",
    );
    assert(
        !officeAdminPermissions.has("parcel.delete"),
        "office_admin must not have parcel.delete",
    );
    assert(
        officeAdminPermissions.has("township-list.view"),
        "office_admin must have township-list.view",
    );
    assert(officeAdminPermissions.has("township.update"), "office_admin must have township.update");
    assert(officeAdminPermissions.has("merchant.view"), "office_admin must have merchant.view");
    assert(officeAdminPermissions.has("merchant.update"), "office_admin must have merchant.update");
    assert(officeAdminPermissions.has("rider.view"), "office_admin must have rider.view");
    assert(officeAdminPermissions.has("rider.update"), "office_admin must have rider.update");

    const merchantPermissions = new Set(ROLE_PERMISSION_MATRIX.merchant);
    assert(!merchantPermissions.has("merchant.view"), "merchant must not have merchant.view");
    assert(!merchantPermissions.has("merchant.update"), "merchant must not have merchant.update");
    assert(!merchantPermissions.has("parcel.view"), "merchant must not have parcel.view");
    assert(merchantPermissions.has("parcel.create"), "merchant must have parcel.create");
    assert(!merchantPermissions.has("parcel.update"), "merchant must not have parcel.update");
    assert(!merchantPermissions.has("rider.view"), "merchant must not have rider.view");
    assert(
        !merchantPermissions.has("township-list.view"),
        "merchant must not have township-list.view",
    );
    assert(!merchantPermissions.has("parcel-list.view"), "merchant must not have parcel-list.view");
    assert(!merchantPermissions.has("parcel.delete"), "merchant must not have parcel.delete");
    assert(
        !merchantPermissions.has("bank-account.view"),
        "merchant must not have bank-account.view",
    );
    assert(
        !merchantPermissions.has("bank-account.create"),
        "merchant must not have bank-account.create",
    );
    assert(
        !merchantPermissions.has("bank-account.update"),
        "merchant must not have bank-account.update",
    );
    assert(
        !merchantPermissions.has("bank-account.delete"),
        "merchant must not have bank-account.delete",
    );

    const riderPermissions = new Set(ROLE_PERMISSION_MATRIX.rider);
    assert(!riderPermissions.has("parcel-list.view"), "rider must not have parcel-list.view");
    assert(!riderPermissions.has("parcel.view"), "rider must not have parcel.view");
    assert(!riderPermissions.has("parcel.update"), "rider must not have parcel.update");
    assert(!riderPermissions.has("rider.view"), "rider must not have rider.view");
    assert(!riderPermissions.has("rider.update"), "rider must not have rider.update");
    assert(!riderPermissions.has("merchant.view"), "rider must not have merchant.view");
    assert(!riderPermissions.has("township-list.view"), "rider must not have township-list.view");
    assert(!riderPermissions.has("parcel.create"), "rider must not have parcel.create");
    assert(!riderPermissions.has("parcel.delete"), "rider must not have parcel.delete");
    assert(!riderPermissions.has("bank-account.view"), "rider must not have bank-account.view");
    assert(!riderPermissions.has("bank-account.create"), "rider must not have bank-account.create");
    assert(!riderPermissions.has("bank-account.update"), "rider must not have bank-account.update");
    assert(!riderPermissions.has("bank-account.delete"), "rider must not have bank-account.delete");

    const superAdminPermissions = new Set(ROLE_PERMISSION_MATRIX.super_admin);
    for (const permission of PERMISSION_SLUGS) {
        assert(superAdminPermissions.has(permission), `super_admin must include ${permission}`);
    }
}

function verifyNoPublicSignupRoute() {
    assert(!existsSync("src/app/(auth)/sign-up/page.tsx"), "Public sign-up page must not exist");
}

function verifySharedPermissionCodesExistAcrossRoles() {
    const merchantViewRoles = new Set(
        Object.entries(ROLE_PERMISSION_MATRIX)
            .filter(([, permissions]) => new Set(permissions).has("merchant.view"))
            .map(([role]) => role),
    );

    const riderViewRoles = new Set(
        Object.entries(ROLE_PERMISSION_MATRIX)
            .filter(([, permissions]) => new Set(permissions).has("rider.view"))
            .map(([role]) => role),
    );

    const townshipListRoles = new Set(
        Object.entries(ROLE_PERMISSION_MATRIX)
            .filter(([, permissions]) => new Set(permissions).has("township-list.view"))
            .map(([role]) => role),
    );

    const parcelUpdateRoles = new Set(
        Object.entries(ROLE_PERMISSION_MATRIX)
            .filter(([, permissions]) => new Set(permissions).has("parcel.update"))
            .map(([role]) => role),
    );
    const bankAccountViewRoles = new Set(
        Object.entries(ROLE_PERMISSION_MATRIX)
            .filter(([, permissions]) => new Set(permissions).has("bank-account.view"))
            .map(([role]) => role),
    );

    assert(
        merchantViewRoles.has("office_admin"),
        "merchant.view must be assigned to office_admin role",
    );
    assert(
        merchantViewRoles.has("super_admin"),
        "merchant.view must be assigned to super_admin role",
    );
    assert(riderViewRoles.has("office_admin"), "rider.view must be assigned to office_admin role");
    assert(riderViewRoles.has("super_admin"), "rider.view must be assigned to super_admin role");
    assert(
        townshipListRoles.has("office_admin"),
        "township-list.view must be assigned to office_admin role",
    );
    assert(
        townshipListRoles.has("super_admin"),
        "township-list.view must be assigned to super_admin role",
    );

    assert(
        parcelUpdateRoles.has("office_admin"),
        "parcel.update must be assigned to office_admin role",
    );
    assert(
        parcelUpdateRoles.has("super_admin"),
        "parcel.update must be assigned to super_admin role",
    );
    assert(
        !parcelUpdateRoles.has("merchant"),
        "parcel.update must not be assigned to merchant role",
    );
    assert(!parcelUpdateRoles.has("rider"), "parcel.update must not be assigned to rider role");
    assert(
        bankAccountViewRoles.has("office_admin"),
        "bank-account.view must be assigned to office_admin role",
    );
    assert(
        bankAccountViewRoles.has("super_admin"),
        "bank-account.view must be assigned to super_admin role",
    );
    assert(
        !bankAccountViewRoles.has("merchant"),
        "bank-account.view must not be assigned to merchant role",
    );
    assert(
        !bankAccountViewRoles.has("rider"),
        "bank-account.view must not be assigned to rider role",
    );
}

function verifyTemporaryPasswordNotPersisted() {
    const baseMigrationSql = readFileSync("src/db/migrations/0000_natural_ben_parker.sql", "utf-8");
    const rlsMigrationSql = readFileSync("src/db/migrations/0001_auth_rls_policies.sql", "utf-8");
    const seedMigrationSql = readFileSync("src/db/migrations/0002_seed_data_template.sql", "utf-8");
    const schemaSource = readFileSync("src/db/schema.ts", "utf-8");

    assert(
        !baseMigrationSql.includes("temporary_password"),
        "Database must not define temporary_password column",
    );
    assert(
        !rlsMigrationSql.includes("temporary_password"),
        "Database must not define temporary_password column",
    );
    assert(
        !seedMigrationSql.includes("temporary_password"),
        "Database must not define temporary_password column",
    );
    assert(
        !baseMigrationSql.includes("temp_password"),
        "Database must not define temp_password column",
    );
    assert(
        !rlsMigrationSql.includes("temp_password"),
        "Database must not define temp_password column",
    );
    assert(
        !seedMigrationSql.includes("temp_password"),
        "Database must not define temp_password column",
    );
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
