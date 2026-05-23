## Context

Merchant users currently have a single parcels page that loads an unfiltered merchant-scoped parcel list. There is no merchant overview route, no settlement-history view for merchants, and no server-side query shape for merchant search, date filtering, status tabs, or pagination. The requested change spans `src/app/dashboard/merchant`, parcel DAL/UI, and settlement DAL/UI, so it benefits from clear query boundaries before implementation.

## Goals / Non-Goals

**Goals:**

- Add a merchant overview route that shows merchant-scoped parcel and remittance metrics.
- Add a merchant settlement-history list limited to `settled` records with server-side search, date filtering, and pagination.
- Extend merchant parcel browsing with server-side search, date filtering, status tabs, and pagination.
- Reuse existing parcel and settlement display patterns where practical without leaking admin-only controls into merchant pages.

**Non-Goals:**

- Creating or resolving merchant settlements from merchant-facing pages.
- Changing settlement math, financial item creation rules, or parcel status lifecycle rules.
- Introducing a new shared backend layer or separate reporting service.
- Expanding merchant parcel filters beyond the requested search, date, and status tabs.

## Decisions

### Decision: Add merchant-specific list queries instead of reusing admin list loaders directly

The parcel and settlement admin loaders return broad datasets and include columns or actions that are not appropriate for merchant pages. The implementation should add merchant-scoped DAL functions with explicit filter inputs and paginated outputs rather than fetching everything and filtering in React.

Rationale:

- Keeps authorization and merchant ownership checks on the server.
- Avoids loading unbounded lists for merchant pages.
- Lets overview and list pages share consistent filter and summary DTOs.

Alternatives considered:

- Reuse current admin list functions and filter in page components. Rejected because it mixes roles, increases payload size, and makes pagination harder.
- Build a generic reporting abstraction first. Rejected because the repository guidance favors explicit, feature-scoped code over premature generalization.

### Decision: Use query-string-driven server rendering for filters and pagination

Both merchant pages should read search params in the route entrypoint, validate them with Zod-backed DTO helpers, and pass typed filters into DAL functions. Search, date filter changes, tab changes, and page changes should update the URL and trigger a server refresh.

Rationale:

- Matches Next.js App Router patterns already used in the codebase.
- Preserves deep-linkable merchant views.
- Keeps pagination and filter state shareable and refresh-safe.

Alternatives considered:

- Keep filters entirely in client component state. Rejected because it complicates initial page load, loses shareable URLs, and would still require server round-trips for correct pagination.

### Decision: Compute overview cards from parcel and settled-settlement aggregates

The overview cards should come from merchant-scoped aggregate queries:

- `Total COD collected`: sum of delivered COD parcel amounts only, excluding delivery fees.
- `Paid to you`: sum of `merchant_settlements.net_payment_amount` for `settled` settlements only.
- `Total Parcels`: count of merchant-owned parcels.
- `On the way parcels`: count of merchant-owned parcels with `status = on_the_way`.
- `Delivered Parcels`: count of merchant-owned parcels with `status = delivered`.

Rationale:

- These definitions match the request and avoid overloading financial item data where parcel-state aggregates are clearer.
- `Paid to you` should come from settled remittance records rather than parcel-level assumptions.

Alternatives considered:

- Derive paid totals from settled financial items only. Rejected because the merchant-visible remittance event is the settlement payment, and `net_payment_amount` already reflects COD minus deductions.

### Decision: Keep merchant pages role-specific in route structure and component surface

The new overview page should live at `src/app/dashboard/merchant/overview/page.tsx`. Merchant parcel enhancements should remain under `src/app/dashboard/merchant/parcels/page.tsx`. Feature UI can reuse internal table primitives, but merchant-facing wrappers should hide admin-only columns or actions as needed.

Rationale:

- Matches the existing role-based dashboard route structure.
- Avoids weakening admin components with excessive role branching.

Alternatives considered:

- Add a role switch to the existing admin settlement table and parcel table everywhere. Rejected because the merchant surface needs fewer actions and different filter controls.

## Risks / Trade-offs

- [Risk] Current table components are admin-oriented and may not fit merchant pages cleanly. → Mitigation: add merchant wrapper components or narrow optional props instead of forcing complex role conditionals into one component.
- [Risk] Date filtering semantics can drift between parcels and settlements. → Mitigation: standardize on filtering by record `createdAt` using one validated date-param shape per page.
- [Risk] Aggregate queries and paginated list queries can duplicate merchant-scoping logic. → Mitigation: centralize merchant lookup and scope helpers inside the relevant feature DAL modules.
- [Risk] Search across recipient name and phone can become inconsistent if matching rules are implicit. → Mitigation: define one search field that performs case-insensitive partial match across both fields for merchant parcels.

## Migration Plan

No schema migration is required. Deploy as an additive UI and DAL change:

1. Add merchant overview route and supporting aggregate/list queries.
2. Add merchant parcel search/filter/pagination query support.
3. Wire page components to URL search params and merchant-facing controls.
4. Verify merchant access remains scoped to the current merchant account.

Rollback is low risk because the change is additive; reverting the route and page query wiring restores the prior merchant experience.

## Open Questions

- Whether the date picker should filter by a single day or a date range. The current request says “date picker filter”, so implementation should default to a single created-date filter unless product direction changes. Answer: single day
- Whether merchants need a separate empty state explanation for “no settled settlements yet” versus “no results match filters”. The UI should likely distinguish them during implementation. Answer: yes, better to have seperatse empty state message.
