# Parcel Flow

Parcel delivery management for a small courier in Yangon: log parcels as they reach the office, assign riders, track every kyat of COD and delivery fees, and turn delivered parcels into merchant settlements and rider payouts.

**[Try the live demo →](https://parcel-flow-production.up.railway.app/)** One click signs you in as an admin, a merchant, or a rider. No sign-up. The demo data resets every night at 00:00 Yangon time.

![Parcel Flow home page](https://parcel-flow-production.up.railway.app/opengraph-image)

## Background

Parcel Flow was designed for a delivery business my sister was planning to start in Yangon. It is modelled on how small local couriers work: pickup arranged on Telegram, cash on delivery, township-based fees, and weekly settlements with merchants. The business plans changed, so it is now a source-available portfolio project.

Pickup still happens outside the app. Parcel Flow starts when parcels reach the office and covers the rest of the operational and money loop.

## What each role sees

| Role | In the demo | What they do |
| --- | --- | --- |
| **Office admin** | Try as Admin | Create, edit and assign parcels; review failed deliveries and decide retry or return; correct a status or rider with a recorded reason; confirm rider cash handovers; build settlements and rider payout drafts. |
| **Merchant** | Try as Merchant | Read-only view of their own parcels, settlement status, and paid settlement history. |
| **Rider** | Try as Rider | Mobile parcel cards: start delivery, mark delivered, report failures, complete merchant returns. |
| **Super admin** | Not in the demo | Everything above, plus user management, township pricing, paying settlements and payouts. |

## Features

- Parcel lifecycle: at office → on the way → delivered, with postpone, cancel and return to merchant
- Delivery fees by township and weight, with COD and fee collection status per parcel
- Corrections that record a reason and their side effects on money
- Financial items generated from parcel events, so settlements and payouts are never typed in twice
- Merchant settlements (with bank transfer receipt) and rider payouts per delivered or returned way
- Realtime parcel updates across admin, merchant and rider views

## Stack

| Area | Tool |
| --- | --- |
| App | Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS, shadcn/ui |
| Auth | Better Auth (username + password, admin-created accounts) |
| Database | PostgreSQL on Supabase, Drizzle ORM |
| Realtime | Supabase Realtime, relayed to the browser over server-sent events |
| Storage | Cloudflare R2 |
| Validation | Zod |
| Hosting | Railway |
| Monitoring | Sentry |
| Tests | Bun (unit, component, integration) and Playwright (end to end) |

## Key decisions

- **Money is derived, not entered.** Delivered and returned parcels create financial items; settlements and payouts only group existing items, which keeps the totals auditable.
- **Server-side permissions everywhere.** Every server action re-checks the actor's role; the proxy only handles routing.
- **Realtime through the server.** The browser never holds Supabase keys. A route handler subscribes with the service key and streams only the rows the signed-in user may see.
- **Specs before code.** Each feature went through an [OpenSpec](openspec/) proposal, design and task list.
- **Measured performance work.** [benchmarks/](benchmarks/) holds the baselines used to tune the data layer and navigation.

## Public demo mode

Setting `NEXT_PUBLIC_DEMO_MODE=1` turns a deployment into the public demo:

- `/demo/[role]` signs visitors in to shared demo accounts with one click (POST only, rate limited).
- Account changes (passwords, users, townships) are blocked on the server for everyone except the super admin, and Better Auth's HTTP endpoints are limited to sign-in, sign-out and session reads.
- Uploads are off; a sample delivery photo or receipt is attached instead.
- Mutations, logins and realtime streams are rate limited or capped.
- `POST /api/demo/reset` (with `Authorization: Bearer $DEMO_RESET_TOKEN`) wipes everything except super admins and loads a small demo data set: 20 parcels covering every status, plus settlements and rider payouts spread over the last three weeks. The [Demo Reset workflow](.github/workflows/demo-reset.yml) calls it nightly. The reset refuses to run if it finds accounts the demo data did not create.

The demo data is a committed snapshot ([src/features/demo/data/snapshot.json](src/features/demo/data/snapshot.json)). `bun run demo:snapshot` builds it by running the seed through the app's own data layer against the local test database, then saving the rows. The reset bulk-loads that file in one transaction and shifts every date so the newest records land on today. That takes a few dozen queries instead of thousands, so it stays fast when the database is in another region. Regenerate the snapshot after schema or seed changes.

Run the same reset from a shell with `bun run db:reset:demo` (add `--force` the first time on a database that has other accounts).

## Getting started

Requires [Bun](https://bun.sh).

```bash
bun install
cp .env.example .env.development
# fill DATABASE_URL, BETTER_AUTH_*, Supabase, and R2 values
bun run db:migrate
bun run db:seed:super-admin
bun run dev
```

Quality checks:

```bash
bun run lint
bun run format:check
bun run typecheck
```

## Testing

```bash
bun run test          # unit + component
bun run test:integration
bun run test:e2e      # Playwright against next build + next start
bun run test:all
```

See [docs/testing.md](docs/testing.md) for database safety rules, Playwright setup, and money-loop e2e and R2 requirements.

## Docs

- [Project specification](docs/parcel-flow-project-spec.md): domain, roles, flows, UI rules
- [Technical services](docs/parcel-flow-technical-services.md): stack choices and service notes
- [Database diagram](docs/database-mermaid-diagram.md)
- [Testing](docs/testing.md)

## License

[PolyForm Noncommercial 1.0.0](https://spdx.org/licenses/PolyForm-Noncommercial-1.0.0.html). See [LICENSE](LICENSE).

The source is available for noncommercial use under the license terms. Commercial use requires separate permission from the copyright holder.
