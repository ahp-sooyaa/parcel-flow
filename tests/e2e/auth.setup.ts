import { test as setup } from "@playwright/test";

import { superAdminCredentials } from "./helpers";

setup("authenticate as super admin", async ({ request }) => {
  const response = await request.post("/api/auth/sign-in/username", {
    data: {
      username: superAdminCredentials.username,
      password: superAdminCredentials.password,
    },
  });

  if (!response.ok()) {
    throw new Error(`API sign-in failed: ${response.status()} ${await response.text()}`);
  }

  await request.storageState({ path: "tests/e2e/.auth/super-admin.json" });
});
