## Why

Super admins currently have no quick way to see current Supabase database usage or the same kind of Cloudflare R2 `Total storage` value shown in the Cloudflare dashboard from the admin overview page. The change is mainly an infrastructure-integration concern because both providers expose storage information through different technical surfaces, and Cloudflare’s free-tier allowance is described as a billing limit in GB-month rather than a strict live-capacity API field.

## What Changes

- Add one super-admin-only overview stats card that shows both Supabase database usage and Cloudflare R2 `Total storage` usage in a single card.
- Use the shadcn progress component to visualize each storage value against an admin-facing reference limit, following the attached compact stats-card pattern without the trial badge.
- Add a manual refresh control on the card so super admins can fetch the latest storage numbers on demand for this MVP.
- Add server-side storage stats loading and refresh support for the admin dashboard, with provider-specific usage fetching normalized for display as used amount, reference limit, and percent used.
- Use the documented Supabase privileged metrics endpoint for database usage and the Cloudflare R2 GraphQL storage analytics fields behind the dashboard-style `Total storage` value, keeping provider credentials on the server.

## Capabilities

### New Capabilities

- `admin-storage-capacity-monitoring`: Super-admin-only dashboard storage monitoring for Supabase database usage and Cloudflare R2 dashboard-style total storage with manual refresh.

### Modified Capabilities

## Impact

- Affects the admin dashboard route at `src/app/dashboard/page.tsx`.
- Affects admin-facing dashboard UI under `src/features` and shared presentation components used on the overview page.
- Requires server-side integration points for the Supabase privileged metrics endpoint and Cloudflare GraphQL analytics API, plus a protected refresh path.
- Requires environment-backed reference-limit configuration, including the Cloudflare R2 free-tier `10 GB-month` allowance used for MVP progress comparison.
- Should stay aligned with the admin dashboard visual language and shadcn/ui component usage defined in the repository rules.
