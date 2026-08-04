import { describe, expect, test } from "bun:test";

import { buildContentSecurityPolicy } from "@/lib/content-security-policy";

describe("content security policy", () => {
  test("builds a cacheComponents-compatible policy without nonces", () => {
    const policy = buildContentSecurityPolicy();

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("strict-dynamic");
    expect(policy).not.toContain("nonce-");
    expect(policy).toContain("style-src-elem 'self' 'unsafe-inline'");
    expect(policy).toContain("style-src-attr 'unsafe-inline'");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("worker-src 'self' blob:");
    expect(policy).toContain("frame-ancestors 'none'");
  });
});
