# Parcel Flow

Next.js web app and API in `src/`, Expo rider app in `mobile/`. The mobile app's architecture, conventions and roadmap are in `docs/mobile-app.md`.

## Local dev servers

### One env file per build folder

Never run a second `next dev` with a different env file into the default `.next` folder.

- `NEXT_PUBLIC_*` values (Sentry DSN, Supabase URL) are compiled into the browser bundle.
- `next dev` keeps a persistent Turbopack cache in `<distDir>/dev/cache`.
- If servers started with `.env.development` and `.env.test` share that cache, Turbopack sees the client entry (`src/instrumentation-client.ts`) as changed on every page load and sends the page a `restart`.

The symptom is an endless reload loop: the server log repeats `✓ Compiled in …ms`, `GET /login 200` and a burst of `POST /api/monitoring` about once a second, and the browser console repeats `[HMR] connected` and `[Fast Refresh] rebuilding`.

- `next.config.ts` reads the build folder from `NEXT_DIST_DIR` (default `.next`). Start any server that uses another env file with its own folder inside `.next`, e.g. `NEXT_DIST_DIR=.next/test-db bun --env-file=.env.test next dev --port 3001`. It can then run alongside `bun run dev`.
- `tsconfig.json` already includes the `.next/test-db` and `.next/demo-local` type folders. A new folder makes `next dev` rewrite `tsconfig.json`; add its includes instead of committing the rewrite.
- To recover from a mixed cache, stop every dev server and delete `.next/dev` (it only holds regenerable dev output).
- `next dev` points `next-env.d.ts` at whichever build folder ran last. Don't commit that change.

### Sentry tunnel

Browser Sentry reports go through our own `src/app/api/monitoring/route.ts` (`tunnel: "/api/monitoring"` in `src/instrumentation-client.ts`), not @sentry/nextjs's `tunnelRoute` rewrite.

- Next.js proxies a rewrite by piping the upstream response, which logs `MaxListenersExceededWarning: 11 close listeners added to [ServerResponse]` for every report.
- The CSP is `connect-src 'self'`, so the browser can't post to Sentry directly.

Don't bring `tunnelRoute` back.
