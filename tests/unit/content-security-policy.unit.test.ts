import { describe, expect, test } from "bun:test";

import {
  buildContentSecurityPolicy,
  createContentSecurityPolicyNonce,
} from "@/lib/content-security-policy";

describe("content security policy", () => {
  test("builds a nonce-based policy with app-specific directives", () => {
    const nonce = "test-nonce";
    const policy = buildContentSecurityPolicy(nonce);

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(policy).toContain("style-src-elem 'self' 'unsafe-inline'");
    expect(policy).toContain("style-src-attr 'unsafe-inline'");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("worker-src 'self' blob:");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  test("generates unique nonces", () => {
    const firstNonce = createContentSecurityPolicyNonce();
    const secondNonce = createContentSecurityPolicyNonce();

    expect(firstNonce).not.toBe(secondNonce);
    expect(firstNonce.length).toBeGreaterThan(0);
  });
});
