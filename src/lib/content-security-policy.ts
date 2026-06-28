export function createContentSecurityPolicyNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function buildContentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
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
  const nonce = createContentSecurityPolicyNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const headers = new Headers(requestHeaders);

  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", contentSecurityPolicy);

  return {
    headers,
    contentSecurityPolicy,
    nonce,
  };
}
