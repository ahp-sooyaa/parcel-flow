/**
 * Shared Sentry options for client, server, and edge runtimes.
 *
 * Use NEXT_PUBLIC_ prefixes so the browser bundle receives the same DSN and
 * environment tag as the server. Set these per Railway environment:
 * - staging: NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging
 * - production: NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
 */
export function getSentryInitOptions() {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.SENTRY_ENVIRONMENT ?? "development",
  };
}
