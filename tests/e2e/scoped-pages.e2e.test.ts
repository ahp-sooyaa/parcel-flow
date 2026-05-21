import { expect, test } from "./fixtures";
import { signIn } from "./helpers";

test("merchant parcel page shows scoped data without admin-only controls", async ({
  page,
  seededUsers,
}) => {
  await signIn(page, seededUsers.merchant);

  await expect(page).toHaveURL(/\/dashboard\/merchant\/parcels/);
  await expect(page.getByRole("button", { name: /create parcel/i })).toHaveCount(0);
});

test("rider parcel page shows scoped data without admin-only controls", async ({
  page,
  seededUsers,
}) => {
  await signIn(page, seededUsers.rider);

  await expect(page).toHaveURL(/\/dashboard\/rider\/parcels/);
  await expect(page.getByRole("button", { name: /create parcel/i })).toHaveCount(0);
});
