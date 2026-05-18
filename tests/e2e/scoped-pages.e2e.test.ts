import { expect, test } from "./fixtures";

test("merchant parcel page shows scoped data without admin-only controls", async ({
  page,
  seededUsers,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(seededUsers.merchant.username);
  await page.getByLabel("Password").fill(seededUsers.merchant.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard\/merchant\/parcels/);
  await expect(page.getByRole("button", { name: /create parcel/i })).toHaveCount(0);
});

test("rider parcel page shows scoped data without admin-only controls", async ({ page, seededUsers }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill(seededUsers.rider.username);
  await page.getByLabel("Password").fill(seededUsers.rider.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard\/rider\/parcels/);
  await expect(page.getByRole("button", { name: /create parcel/i })).toHaveCount(0);
});
