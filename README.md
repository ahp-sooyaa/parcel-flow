# Parcel Flow

Internal delivery management system for parcels after they arrive at the office.

Pickup happens outside the app (today via Telegram). Parcel Flow starts when parcels reach the office, and covers the rest of the operational and money loop: records, rider assignment, delivery status, COD and delivery-fee collection, merchant settlements, and rider payouts.

## MVP

- Admin-created accounts with username/password login (no public signup)
- Four roles: **Super Admin**, **Office Admin**, **Merchant**, **Rider**
- Parcel create / edit / assign / status tracking
- Delivery fee calculation and COD collection tracking
- Merchant settlement from eligible financial items (with bank-transfer receipt on paid)
- Rider payout by payable delivery-attempt and merchant-return way count
- Merchant overview and paid settlement history
- Realtime parcel sync across admin, merchant, and rider views

## Stack

| Area | Tool |
| --- | --- |
| App | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Auth | Better Auth |
| Database | PostgreSQL (Supabase) + Drizzle ORM |
| Storage | Cloudflare R2 |
| Validation | Zod |
| Hosting | Railway |
| Tests | Bun (unit/integration) + Playwright (e2e) |

## Docs

- [Project specification](docs/parcel-flow-project-spec.md) — domain, roles, flows, UI rules
- [Technical services](docs/parcel-flow-technical-services.md) — stack choices and service notes
- [Database diagram](docs/database-mermaid-diagram.md)
- [Testing](docs/testing.md)

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

See [docs/testing.md](docs/testing.md) for database safety rules, Playwright setup, and money-loop e2e / R2 requirements.

## License

[PolyForm Noncommercial 1.0.0](https://spdx.org/licenses/PolyForm-Noncommercial-1.0.0.html) — see [LICENSE](LICENSE).

Noncommercial use is permitted under the license terms. Commercial use requires a separate permission from the copyright holder.
