## 1. Storage Stats Server Integration

- [x] 1.1 Add dashboard-scoped DTOs and server helpers to fetch and normalize Supabase database usage from the privileged metrics endpoint and Cloudflare R2 total storage from Cloudflare analytics fields.
- [x] 1.2 Enforce `super_admin`-only authorization for both initial storage stats loading and manual refresh requests.
- [x] 1.3 Represent each storage provider row with used amount, reference limit, percent used, and fetch status so partial failures can render safely.
- [x] 1.4 Add server configuration for reference-limit values, including the R2 free-tier 10 GB MVP reference, and document any missing provider env requirements needed by the new integrations.

## 2. Manual Refresh Flow

- [x] 2.1 Add a protected server action that re-fetches both storage metrics for the admin dashboard card.
- [x] 2.2 Revalidate or refresh the dashboard storage card state after successful manual refresh without forcing the admin away from the dashboard page.
- [x] 2.3 Return actionable refresh failure states so the card can show unavailable data when one or both providers fail.

## 3. Admin Dashboard UI

- [x] 3.1 Add one compact storage capacity card to `src/app/dashboard/page.tsx` using the existing dashboard visual language.
- [x] 3.2 Ensure the storage card renders only for `super_admin` and is omitted entirely for office admin, merchant, and rider users.
- [x] 3.3 Build the card UI with two storage rows, shadcn progress components, and a refresh icon control that matches the requested MVP layout without a trial badge.
- [x] 3.4 Show Supabase database usage and Cloudflare R2 total storage in the same card with used amount, reference limit, and percent-based progress.
- [x] 3.5 Label or phrase the Cloudflare row so it reads as dashboard-style total storage rather than exact monthly billed GB-month usage.
- [x] 3.6 Add pending and unavailable states for the refresh interaction and degraded provider responses.

## 4. Verification

- [x] 4.1 Add or update tests for storage stats normalization, including Cloudflare total-storage derivation from analytics fields, `super_admin` authorization, and refresh action behavior.
- [x] 4.2 Add component coverage for the storage capacity card rendering, refresh interaction, and unavailable-state display.
- [x] 4.3 Run lint, typecheck, and the relevant unit or integration tests after implementation.
