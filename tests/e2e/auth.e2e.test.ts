import { expect, test } from "./fixtures";

test("redirects unauthenticated dashboard users to login", async ({ page }) => {
  await page.goto("/dashboard/parcels");

  await expect(page).toHaveURL(/\/login$/);
});

test("signs in a seeded super admin and lands on the admin dashboard", async ({
  page,
  seededUsers,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(seededUsers.superAdmin.username);
  await page.getByLabel("Password").fill(seededUsers.superAdmin.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
});

test("redirects merchant users away from admin parcel management", async ({ page, seededUsers }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(seededUsers.merchant.username);
  await page.getByLabel("Password").fill(seededUsers.merchant.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard\/merchant\/parcels/);

  await page.goto("/dashboard/parcels");
  await expect(page).toHaveURL(/\/dashboard\/merchant\/parcels/);
});
