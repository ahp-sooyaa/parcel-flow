## Context

The admin dashboard currently loads parcel summary cards and the merchant settlement workspace on the server, but it does not expose any infrastructure-capacity visibility. The requested change adds one compact stats card to the same overview surface and depends on two external providers: Supabase for database usage and Cloudflare R2 for image-storage usage.

The repository rules favor the existing Next.js monolith, server-enforced authorization, feature-sliced placement, and shadcn/ui components. This change needs an explicit server-side integration boundary because the raw provider responses differ and the documented provider capabilities are asymmetric:

- Supabase documents a privileged metrics endpoint at `https://<project-ref>.supabase.co/customer/v1/privileged/metrics`, authenticated with HTTP Basic using `service_role` and a secret key or with a bearer account token.
- Cloudflare documents R2 storage analytics through the Cloudflare GraphQL Analytics API. The dashboard-style storage view can be derived from `r2StorageAdaptiveGroups`, which returns `payloadSize` and `metadataSize` over a time window, while free-tier storage is described as `10 GB-month / month`, a billing allowance rather than a live quota field.

That means the UI contract should distinguish live provider-reported usage from a reference limit used for progress visualization, and the R2 row should be described as dashboard-style total storage rather than precise monthly billable GB-month consumption.

## Goals / Non-Goals

**Goals:**

- Show one super-admin-only dashboard card with Supabase database usage and Cloudflare R2 dashboard-style total storage in the same compact surface.
- Normalize both providers into one typed dashboard read model containing label, used amount, reference limit, percent used, and fetch status.
- Support manual refresh from the card without introducing background jobs.
- Keep provider credentials and authorization checks on the server, limited to the `super_admin` role.

**Non-Goals:**

- No cron job, scheduled snapshotting, or persistent historical tracking in this change.
- No alerts, notifications, threshold rules, or color escalation beyond the progress visualization already on the card.
- No new backend service, queue worker, or separate monitoring subsystem.
- No broader dashboard redesign beyond inserting the new card into the existing overview layout.

## Decisions

### Decision: Add a dashboard-scoped server module that normalizes provider stats

Create a feature-scoped server path for dashboard storage metrics, such as `src/features/dashboard/server`, with one loader responsible for calling Supabase and Cloudflare integrations and returning a UI-friendly DTO. The page component should consume a single normalized object instead of knowing provider-specific response shapes.

Rationale:

- Keeps external API details out of UI components.
- Matches the repo rule to keep business logic out of `src/components`.
- Makes the later cron-based implementation easier because the UI contract can stay stable while the data source changes.

Alternatives considered:

- Call provider SDKs directly in `src/app/dashboard/page.tsx`. Rejected because it mixes route rendering with integration logic and makes refresh reuse awkward.
- Add a generic monitoring service layer at the repository root. Rejected because the change is small and the repo explicitly avoids premature abstraction.

### Decision: Use a super-admin-only server action for manual refresh

The card refresh control should call a protected server action that re-fetches both storage metrics, returns the normalized payload, and revalidates the dashboard view as needed. The client card wrapper can use this action to show a pending state around the refresh icon while keeping the rest of the page intact.

Rationale:

- Preserves server-side secrets and permission checks.
- Fits the requested MVP behavior without adding polling or route-specific API handlers unless implementation detail requires one.
- Works cleanly with an otherwise server-rendered dashboard page by isolating the refresh interaction in a small client component.

This protection should be stricter than general admin access: only `super_admin` can load or refresh the storage card, and office admins should see no card shell at all.

Alternatives considered:

- Full-page browser refresh. Rejected because the request calls for an in-card refresh control and a tighter operator workflow.
- Client-side fetch to third-party providers. Rejected because credentials and authorization must remain server-side.

### Decision: Fetch Supabase usage from the privileged metrics endpoint with the existing secret key

The Supabase side should call `GET https://<project-ref>.supabase.co/customer/v1/privileged/metrics` from the server and authenticate with HTTP Basic using `service_role:<SUPABASE_SECRET_KEY>`. The loader should derive `<project-ref>` from existing server-safe configuration such as the Supabase project URL or explicit project id env configuration, then parse the returned metrics payload for the database size metric needed by the card.

Rationale:

- This is the documented project metrics endpoint surfaced by Supabase docs.
- It works with the secret key that already exists in the repository environment model.
- It avoids requiring direct SQL execution against the production database just to compute usage.

Alternatives considered:

- Execute `pg_database_size` through a management SQL endpoint or direct database connection. Rejected for the spec because the documented privileged metrics endpoint is the more direct observability surface for this use case.
- Depend on a project-details quota endpoint. Rejected because current documentation reviewed for this change did not provide a clear, stable quota response suitable for the card contract.

### Decision: Fetch Cloudflare R2 dashboard-style total storage from GraphQL and compare it to the free-tier reference limit

The Cloudflare side should call the Cloudflare GraphQL endpoint at `https://api.cloudflare.com/client/v4/graphql` using a bearer `CLOUDFLARE_R2_API_TOKEN`, scoped to the configured account and R2 bucket. The implementation should query `r2StorageAdaptiveGroups` and derive a dashboard-style total storage value from the latest `payloadSize + metadataSize`, matching the kind of `Total storage` figure shown in the Cloudflare dashboard. For MVP progress visualization, the card should compare that current total-storage value against the R2 free-tier reference limit of `10 GB-month / month`, while explicitly treating that denominator as an operator-facing reference rather than an exact billing calculation.

Rationale:

- Cloudflare documentation reviewed for this change points R2 storage metrics to the GraphQL Analytics API and specifically exposes `payloadSize` and `metadataSize` for storage.
- The repository already uses R2 account and bucket configuration for uploads, so the monitoring change can stay aligned with that integration model.
- The user wants something close to the dashboard `Total storage` view, not an operations or request-count card.
- A reference denominator is still necessary to support the requested progress visualization because the provider does not expose a live hard-capacity ceiling for current bytes stored.

Alternatives considered:

- Use the S3-compatible API alone to infer full bucket usage. Rejected because the reviewed docs point storage analytics to GraphQL rather than an S3 quota API.
- Pretend the provider exposes a fixed quota and hardcode one. Rejected because it would misrepresent provider behavior.

### Decision: Add explicit storage-reference-limit environment variables

The implementation should use explicit server env vars for progress denominators, for example `SUPABASE_DATABASE_REFERENCE_BYTES` and `CLOUDFLARE_R2_REFERENCE_BYTES`, instead of burying limit numbers in code. Existing provider env vars should continue to supply credentials and identity, with `CLOUDFLARE_R2_API_TOKEN` added to documented environment requirements if it is not already captured in `.env.example`. For the user’s current R2 free-tier setup, the default reference should map to 10 GB.

Rationale:

- Keeps the card technically honest by separating provider usage from application-defined reference thresholds.
- Lets operations change reference limits without code edits.
- Makes it clear which values are provider facts versus local configuration.

Alternatives considered:

- Hardcode reference values in the loader. Rejected because it hides operational configuration in source.
- Reuse a single generic storage limit env var. Rejected because Supabase and R2 are distinct resources with different sizing behavior.

### Decision: Model each provider row with explicit success and unavailable states

The storage DTO should include per-row fetch status so the card can render partial success. If one provider fails, the card should still render the other metric and show an unavailable state for the failed row instead of hiding the entire card.

Rationale:

- Prevents one flaky provider from removing the entire monitoring surface.
- Matches the operational use case where partial visibility is still better than no visibility.
- Gives implementation room to surface retry feedback without inventing a new error page.

Alternatives considered:

- Fail the whole card on any provider error. Rejected because it loses usable information and creates unnecessary blank states.

### Decision: Keep manual refresh stateless for MVP and treat limits as reference values

Each dashboard load and refresh action should fetch live provider usage values on demand and avoid writing snapshots to the database. Progress denominators should come from server configuration, not persisted snapshots or guessed provider quotas. For R2 specifically, the denominator is a reference against the free-tier allowance, not a direct monthly billing meter. The later cron job can replace or augment the live loader without changing the card contract.

Rationale:

- Delivers the requested behavior with minimal scope.
- Avoids schema changes and retention decisions before they are needed.

Alternatives considered:

- Persist refresh results to a table immediately. Rejected because scheduled snapshots are explicitly deferred and storage history is out of scope.

## Risks / Trade-offs

- [Risk] R2 current total storage bytes are not identical to monthly billed GB-month usage. → Mitigation: label the R2 row as total storage, use the free-tier value only as a reference bar, and avoid describing the progress number as billing-exact usage.
- [Risk] Refresh actions can feel inconsistent if the server-rendered page and client state diverge. → Mitigation: have the refresh action return the updated payload directly and revalidate the dashboard route after success.
- [Risk] Adding a small client wrapper to a mostly server-rendered page can introduce extra UI complexity. → Mitigation: keep the client boundary limited to the storage card refresh interaction while leaving the rest of the dashboard server-rendered.
- [Risk] Unauthorized access to provider-backed metrics would expose infrastructure details. → Mitigation: gate both initial load and refresh through the same admin server authorization checks.
- [Risk] Office admins can see infrastructure data that should remain restricted. → Mitigation: gate both initial load and refresh specifically on the `super_admin` role and omit the card entirely for every other role.
- [Risk] Metric field names in the Supabase or Cloudflare payload can change or be absent. → Mitigation: isolate parsing in provider-specific adapters and surface an unavailable state if required fields are missing.

## Migration Plan

No database migration is required.

1. Add the dashboard storage stats server loader and DTO normalization.
2. Add environment-backed reference-limit configuration and any missing provider env documentation.
3. Add the protected manual refresh server action.
4. Add the storage capacity card UI to the admin dashboard using shadcn progress and a refresh icon.
5. Verify `super_admin`-only access and graceful degraded rendering when provider fetches fail.

Rollback is low risk because the change is additive. Removing the card and its server module restores the current dashboard behavior without affecting parcel or settlement flows.

## Open Questions

- Which exact Supabase metric name in the privileged metrics payload should be treated as the database-used-bytes value for the card. This needs confirmation during implementation against a real project response.
- Which Cloudflare query window should be used to select the latest trustworthy `r2StorageAdaptiveGroups` sample for the R2 total-storage row.
- Whether failed rows should display the last successful value from the current page render or only an unavailable state after a failed manual refresh. MVP should prefer correctness and show unavailable rather than stale success data unless product direction changes.
