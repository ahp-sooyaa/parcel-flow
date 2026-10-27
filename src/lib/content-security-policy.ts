/**
 * Cache Components / Partial Prerendering is incompatible with nonce-based CSP:
 * static shell scripts cannot receive a per-request nonce, while `'strict-dynamic'`
 * disables host allowlists — so client JS (Radix dropdowns/sheets) gets blocked.
 *
 * Use a stable, non-nonce policy that allows Next.js inline flight scripts and
 * same-origin bundles. Prefer `'unsafe-inline'` over nonces while cacheComponents
 * remains enabled. See: https://nextjs.org/docs/app/guides/content-security-policy
 */
export function buildContentSecurityPolicy() {
  const isDev = process.env.NODE_ENV === "development";

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    // React, Radix, Sonner, and Next.js rely on inline styles or client-injected <style> tags.
    "style-src-elem 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function createContentSecurityPolicyRequestHeaders(requestHeaders: Headers) {
  const contentSecurityPolicy = buildContentSecurityPolicy();
  const headers = new Headers(requestHeaders);

  headers.set("Content-Security-Policy", contentSecurityPolicy);

  return {
    headers,
    contentSecurityPolicy,
  };
}
