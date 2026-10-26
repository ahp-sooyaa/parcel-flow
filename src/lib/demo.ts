import type { UserRole } from "@/lib/domain";

export type DemoRole = "admin" | "merchant" | "rider";

export type DemoAccount = {
  role: Exclude<UserRole, "super_admin">;
  username: string;
  name: string;
  password: string;
};

// Public on purpose: the login page shows these so visitors can sign in by hand.
// The accounts are throwaway demo users that are recreated every night.
const demoPassword = "49ysuYQJbxty"; // NOSONAR: intentionally public demo credential

export const DEMO_ACCOUNTS: Record<DemoRole, DemoAccount> = {
  admin: {
    role: "office_admin",
    username: "demo-admin",
    name: "Thida Aung",
    password: demoPassword,
  },
  merchant: {
    role: "merchant",
    username: "demo-merchant",
    name: "Hnin Wai Phyo",
    password: demoPassword,
  },
  rider: {
    role: "rider",
    username: "demo-rider",
    name: "Kyaw Zin Htet",
    password: demoPassword,
  },
};

export const DEMO_RESTRICTED_MESSAGE =
  "This action is disabled in the public demo. Clone the repo to try it yourself.";

export const DEMO_ASSET_KEYS = {
  proofImages: ["demo/proof-1.jpg", "demo/proof-2.jpg", "demo/proof-3.jpg"],
  receipt: "demo/receipt.png",
} as const;

export function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1";
}

export function isDemoRole(value: string): value is DemoRole {
  return value === "admin" || value === "merchant" || value === "rider";
}

export class DemoRestrictedError extends Error {
  constructor(message = DEMO_RESTRICTED_MESSAGE) {
    super(message);
    this.name = "DemoRestrictedError";
  }
}

/**
 * Blocks account and shared-config changes for visitors in demo mode.
 * The real super admin keeps full access so the deployment stays manageable.
 */
export function assertDemoAllowed(actor: { role: UserRole }) {
  if (isDemoMode() && actor.role !== "super_admin") {
    throw new DemoRestrictedError();
  }
}

export function isDemoRestricted(actor: { role: UserRole }) {
  return isDemoMode() && actor.role !== "super_admin";
}

export function pickDemoProofImageKey(seed: string) {
  let hash = 0;

  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return DEMO_ASSET_KEYS.proofImages[hash % DEMO_ASSET_KEYS.proofImages.length];
}

// The app talks to Better Auth through server actions (auth.api.*), so the
// HTTP surface only needs sign-in, sign-out and session reads. In the public
// demo everything else (admin/remove-user, set-role, change-password, ...) is
// closed so shared demo accounts cannot be taken over or deleted.
const demoAllowedAuthEndpoints = {
  GET: new Set(["/get-session", "/ok"]),
  POST: new Set(["/sign-in/username", "/sign-out"]),
} as const;

export function isAllowedAuthEndpointInDemo(method: "GET" | "POST", pathname: string) {
  const endpoint = pathname.replace(/^\/api\/auth/, "").replace(/\/+$/, "");
  return demoAllowedAuthEndpoints[method].has(endpoint);
}
