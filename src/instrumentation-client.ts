// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { replayIntegration } from "@sentry/browser";

import { getSentryInitOptions } from "@/lib/sentry-config";

Sentry.init({
  ...getSentryInitOptions(),

  // Send reports through our own origin so ad blockers don't drop them and the
  // CSP can stay at `connect-src 'self'` (src/app/api/monitoring/route.ts).
  tunnel: "/api/monitoring",

  // Add optional integrations for additional features
  integrations: [replayIntegration()],

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Only record replays around errors. Recording ordinary demo sessions would
  // use up the replay quota.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

export const onRouterTransitionStart = () => undefined;
