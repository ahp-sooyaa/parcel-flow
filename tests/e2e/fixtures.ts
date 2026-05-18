import { test as base } from "@playwright/test";

type SeededUsers = {
  superAdmin: { username: string; password: string };
  officeAdmin: { username: string; password: string };
  merchant: { username: string; password: string };
  rider: { username: string; password: string };
};

export const test = base.extend<{ seededUsers: SeededUsers }>({
  seededUsers: async ({ page: _page }, use) => {
    await use({
      superAdmin: {
        username: process.env.E2E_SUPER_ADMIN_USERNAME ?? "e2e-super-admin",
        password: process.env.E2E_SUPER_ADMIN_PASSWORD ?? "password123",
      },
      officeAdmin: {
        username: process.env.E2E_OFFICE_ADMIN_USERNAME ?? "e2e-office-admin",
        password: process.env.E2E_OFFICE_ADMIN_PASSWORD ?? "password123",
      },
      merchant: {
        username: process.env.E2E_MERCHANT_USERNAME ?? "e2e-merchant",
        password: process.env.E2E_MERCHANT_PASSWORD ?? "password123",
      },
      rider: {
        username: process.env.E2E_RIDER_USERNAME ?? "e2e-rider",
        password: process.env.E2E_RIDER_PASSWORD ?? "password123",
      },
    });
  },
});

export { expect } from "@playwright/test";
