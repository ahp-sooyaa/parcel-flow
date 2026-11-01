import { withSentryConfig } from "@sentry/nextjs";

const nextConfig = {
  // Dev servers started with a different env file (e.g. .env.test) get their
  // own folder: NEXT_PUBLIC_* values are compiled into the client bundle, and a
  // Turbopack cache shared across env files makes open pages reload in a loop.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  serverExternalPackages: ["@aws-sdk/client-s3"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "clickr",

  project: "parcel-flow",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Browser reports reach Sentry through our own /api/monitoring route (set as
  // `tunnel` in src/instrumentation-client.ts), not the `tunnelRoute` rewrite:
  // Next.js's rewrite proxy logs MaxListenersExceededWarning for every report.

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
