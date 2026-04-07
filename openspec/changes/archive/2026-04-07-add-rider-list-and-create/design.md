## Context

The dashboard already has a merchant list/create workflow with clear separation across route, feature components, server action, DAL, DTO, and validation helpers. Rider navigation and permissions (`rider-list.view`, `rider.create`, etc.) already exist, but the rider page is still a placeholder and no rider feature module exists.

The current Drizzle schema contains `app_users` and `merchants`, but does not yet define a `riders` table. The project requires schema-first changes with generated migrations only. The team also explicitly wants township to remain a static list for now and to defer township master-table integration.

## Goals / Non-Goals

**Goals:**
- Deliver rider list and rider create capabilities that match the merchant feature quality and patterns.
- Enforce server-side authorization and zod validation for rider mutations.
- Add a rider persistence model in Drizzle linked to `app_users`, with generated migration.
- Keep rider UI/business logic boundaries clear and maintainable using the existing feature-sliced structure.
- Keep township as static options in this phase.

**Non-Goals:**
- Implement township CRUD or dynamic township lookup from DB tables.
- Implement rider update/delete flows in this change.
- Introduce new backend services, new architectural layers, or non-monolith patterns.

## Decisions

1. **Mirror merchant feature structure for rider feature**
- Decision: create `src/features/rider/components`, `src/features/rider/server/actions.ts`, `dal.ts`, `dto.ts`, and `utils.ts`, and wire new rider pages under `src/app/(dashboard)/dashboard/riders`.
- Rationale: keeps consistency, shortens onboarding, and reduces risk by reusing known patterns.
- Alternative considered: build generic shared CRUD abstractions for merchant/rider. Rejected because the project intentionally prefers explicit, domain-first code over extra abstractions.

2. **Add a dedicated `riders` table in `src/db/schema.ts` and generate migration from schema**
- Decision: add rider columns aligned with current scope: profile name, phone, address, township (text), notes, linked app user, timestamps, and useful indexes/constraints.
- Rationale: rider list/create needs durable rider records and a one-to-one link to app users for role/account association.
- Alternative considered: store riders directly in `app_users` only. Rejected because rider is a domain profile and should remain separate like merchant.

3. **Use existing static township options for rider create form**
- Decision: reuse static township list for now (either shared constant or rider-local copy following final implementation choice).
- Rationale: aligns with user direction to defer township feature and keeps scope focused on rider list/create.
- Alternative considered: add township table and foreign key now. Rejected as out of scope and would increase migration + UI complexity.

4. **Authorization and validation remain server-enforced with fail-closed behavior**
- Decision: require `rider-list.view` for list page and `rider.create` for create page/action; use zod parsing inside server action; shape responses through DTOs.
- Rationale: follows security baseline and prevents trust in client-provided data.
- Alternative considered: client-side validation only with permissive server writes. Rejected due to security and data integrity risks.

5. **Operational visibility via audit log + cache revalidation**
- Decision: emit audit event on rider creation and revalidate riders list route after successful mutation.
- Rationale: keeps operational traceability and immediate UI consistency.
- Alternative considered: no audit for MVP. Rejected because rider creation affects operations and should remain auditable.

## Risks / Trade-offs

- [Risk] Rider table shape may diverge from future township normalization. → Mitigation: keep township as plain text currently and document future migration path to township FK.
- [Risk] Linking to app users may produce duplicate-link attempts. → Mitigation: enforce unique linked user constraint and pre-insert existence checks in DAL/action.
- [Risk] Merchant/rider similarities can encourage copy-paste drift. → Mitigation: mirror structure intentionally but keep rider-specific naming and tests to prevent accidental merchant coupling.
- [Trade-off] Shipping list/create first excludes update/delete in this iteration. → Mitigation: keep DTO/DAL boundaries clean so update/delete can be added as follow-up with low churn.

## Migration Plan

1. Add `riders` table and related types/indexes in `src/db/schema.ts`.
2. Run Drizzle generate + migrate using project workflow (no hand-written SQL).
3. Implement rider feature files and pages, including list and create route integration.
4. Verify permission gates and success/failure flows locally.
5. Rollout with standard deployment process.

Rollback strategy:
- Revert app code and migration if release is blocked before production cutover.
- If migration is already applied and rollback is needed, follow normal forward-fix migration practice (do not manually edit generated migration history).

## Open Questions

- Should rider code format follow a strict pattern now (e.g., `RDR-0001`) or stay optional/free text until a future requirement exists? Answer: follow a strict pattern, 'RDR-XXXX'
- For rider creation, should linkable users be restricted to `rider` role only (recommended), or allow any active user role? Answer: yes. restricted to rider role only, because role are connected with permission and rider should have rider permission only.
