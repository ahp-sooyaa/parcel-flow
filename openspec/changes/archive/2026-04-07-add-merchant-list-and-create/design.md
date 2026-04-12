## Context

Parcel Flow currently lacks a structured merchant module even though merchant identity is operationally critical for parcel intake, routing, and settlement tracking. Internal office/admin staff need a fast and consistent workflow to register and find merchants, while merchant-role users must be constrained to their own profile scope.

The app is a Next.js monolith with feature-sliced structure and permission-based authorization stored in the application database. This change introduces a merchant foundation that is secure by default, avoids public signup, and keeps future parcel/payment relationships in mind without implementing those views yet.

## Goals / Non-Goals

**Goals:**
- Provide an internal merchant list page for authorized staff with practical, fast lookup.
- Provide an internal merchant create page with clean form UX and explicit server-side input handling.
- Define merchant data model fields for operational use now and compatibility with future parcel/settlement features.
- Enforce server-side authorization boundaries consistent with role/permission model.
- Support optional merchant-to-app-user linking for future admin-created merchant login.

**Non-Goals:**
- Public merchant signup or self-registration flows.
- Merchant parcel history UI and payment/settlement UI.
- Full merchant self-scope detail filtering implementation beyond defining the rule and constraints.
- New backend service layers or non-monolith architecture changes.

## Decisions

### 1) Feature-sliced merchant module in monolith
- Decision: Implement merchant capability under `src/features/merchant/*` with page composition in `src/app`, keeping business logic in server files (`actions.ts`, `dal.ts`, `dto.ts`, `utils.ts`).
- Rationale: Aligns with existing architecture and reduces long-term maintenance risk.
- Alternatives considered:
  - Service/repository abstraction layer: rejected as unnecessary complexity for current project conventions.
  - Separate microservice: rejected because it violates monolith-first constraint.

### 2) Server-enforced authorization for list/create
- Decision: Gate merchant list and merchant create endpoints/actions via server-side authorization checks against app roles/permissions from database state.
- Rationale: Client-side checks are bypassable; internal operations require fail-closed behavior.
- Alternatives considered:
  - UI-only role gating: rejected due to security exposure.

### 3) Explicit merchant create input contract
- Decision: Validate payload with zod on server; phone is optional; write only allowlisted fields (`name`, `phone`, `address`, `township`, `notes`, optional linked user id).
- Rationale: Prevents accidental sensitive writes and supports auditability for money-adjacent workflows.
- Alternatives considered:
  - Passing raw form object directly to DB write: rejected due to security and correctness risk.

### 4) Search-oriented list query design
- Decision: Implement merchant list query with indexed search over merchant name and phone (when present), plus deterministic ordering for fast operational scanning.
- Rationale: Supports office workflow where speed of finding merchant records matters more than complex analytics.
- Alternatives considered:
  - Full-text external search engine: rejected as premature complexity.

### 5) Future-ready merchant identity linkage
- Decision: Store optional relation from merchant to app user account (admin-created) while keeping merchant record valid without linked user.
- Rationale: Supports phased rollout of merchant login without blocking current internal onboarding.
- Alternatives considered:
  - Mandatory linked user on creation: rejected because current workflow is internal-first and many merchants may not need login yet.

## Risks / Trade-offs

- [Risk] Over-broad access allows merchant-role users to see all merchants. → Mitigation: enforce list permission separately from self-scope detail rule and test denial cases.
- [Risk] Duplicate merchant records from weak matching. → Mitigation: start with clear search + optional validation warnings; defer fuzzy dedupe policy to follow-up change.
- [Risk] Incomplete future compatibility with parcel/settlement linkage. → Mitigation: include stable merchant identifiers and optional linked-user relation now; extend with explicit foreign keys in later change.
- [Risk] Staff may enter inconsistent address/township values. → Mitigation: use explicit required fields and validation boundaries; consider controlled township catalog in future iteration.

## Migration Plan

1. Add merchant schema/table changes and indexes for lookup fields.
2. Add server DAL/action/DTO/utils for list and create flows with authorization checks.
3. Add merchant list/create pages and integrate with shared layout and permission gating.
4. Run internal validation with admin/staff roles and merchant role denial tests.
5. Roll out to internal users only.

Rollback:
- Disable merchant routes and server actions via deployment rollback.
- Keep existing data intact; schema rollback only if strictly required and after data export review.

## Open Questions

- Should township be free-text in v1 or constrained to a predefined township list immediately?
  Answer: In the first iteration, render a predefined township list in the create form. Later, after township management is implemented, load township options from the township table instead.

- What exact permission keys will represent merchant list, create, and self-detail access in the existing auth model?
  Answer: Use the existing permission keys:
  - `merchant-list.view`
  - `merchant.view`
  - `merchant.create`
  - `merchant.update`
  - `merchant.delete`

  Do not introduce a separate self-detail permission such as `merchant:detail:self` in the first iteration. Use `merchant.view` and enforce merchant self-scope detail access in server-side queries with filtering / where clauses.

- Should linked app user be unique one-to-one with merchant at database level in v1, or remain soft-enforced initially?
  Answer: Keep the one-to-one merchant-to-app-user relationship soft-enforced in the first iteration.
