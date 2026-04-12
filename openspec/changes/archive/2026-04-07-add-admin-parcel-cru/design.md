## Context

The dashboard currently lacks a complete parcel workflow for office staff to register and maintain delivery records with linked payment state. The requested scope introduces admin-facing parcel CRU over three existing tables (`parcels`, `parcel_payment_records`, `parcel_audit_logs`) with strict role control and explicit default statuses to keep accounting and operations consistent.

Constraints from project architecture and policy:
- Next.js monolith with feature-sliced structure.
- Server actions for mutations with zod validation.
- DAL/DTO/utils separation in feature server layer.
- No soft delete for parcel, payment record, or audit tables.
- Authorization enforced on server; client role data is never trusted.

Stakeholders:
- Operations/admin users who create and correct parcel records.
- Finance/accounting users who depend on clear status semantics.
- Future rider workflow owners, which is explicitly deferred.

## Goals / Non-Goals

**Goals:**
- Provide admin dashboard parcel create, read, and update flows for `superadmin` and `admin`.
- Capture parcel and payment record inputs in one guided experience while writing to the correct tables atomically.
- Enforce default lifecycle/payment statuses at creation time in server code.
- Restrict setting parcel status to `cancelled` to `superadmin` and `admin`.
- Persist audit entries for create/update events originating from both `parcels` and `parcel_payment_records`, linked by parcel.

**Non-Goals:**
- Rider-facing parcel status/payment updates.
- Soft-delete or restore behavior for parcel-related tables.
- Replacing existing accounting models or introducing new services.

## Decisions

### Decision: Implement one parcel feature slice with split mutation actions
We will add `src/features/parcels` with:
- `server/actions.ts` for create/update server actions.
- `server/dal.ts` for all DB operations (`parcels`, `parcel_payment_records`, `parcel_audit_logs`).
- `server/dto.ts` for safe shaping of parcel list/detail payloads.
- `server/utils.ts` for feature-specific helpers (default status map, status transition guard, actor metadata extraction).

Rationale:
- Matches existing project conventions and keeps business logic out of UI.
- Makes later rider workflows additive rather than tangled into admin logic.

Alternative considered:
- Splitting parcel and payment into separate features immediately.
- Rejected because current scope is tightly coupled at create/update time and would add unnecessary coordination overhead.

### Decision: Use transactional writes for parcel + payment record + audit log
Create and update mutations will run in a single DB transaction when touching multiple tables.

Rationale:
- Prevents partial writes (for example parcel created without payment record defaults).
- Supports accounting correctness and reliable auditability.

Alternative considered:
- Sequential non-transactional writes with error recovery.
- Rejected due to higher risk of inconsistent operational/financial state.

### Decision: Server-enforced default statuses and explicit allowlist mapping
Defaults for new parcels are applied in server action/utils, not from client payload:
- `parcel_status = pending`
- `delivery_fee_status = unpaid`
- `cod_status = pending`
- `collection_status = pending`
- `merchant_settlement_status = pending`
- `rider_payout_status = pending`
- `delivery_fee_payer = receiver`

Rationale:
- Fail-closed behavior and deterministic onboarding state for every new parcel.
- Prevents accidental or malicious initial state manipulation.

Alternative considered:
- Prefilling on client and trusting submitted values.
- Rejected due to security and consistency risks.

### Decision: Status authorization checks at mutation boundary
Update action will explicitly gate `parcel_status = cancelled` to `superadmin` and `admin`. Any unauthorized request fails before DB write.

Rationale:
- Enforces policy at the authoritative server boundary.
- Keeps cancellation control auditable and predictable.

Alternative considered:
- UI-level role hiding only.
- Rejected because client-only checks are bypassable.

### Decision: Audit entries capture source table context with parcel linkage
Each audit entry will remain parcel-linked but MUST include source context indicating whether the change came from `parcels` or `parcel_payment_records`.

Rationale:
- Keeps one parcel-centered audit trail while preserving where each change originated.
- Improves operational debugging and accounting traceability without introducing separate audit chains.

Alternative considered:
- Logging only generic parcel-level actions without source context.
- Rejected because it obscures whether a change was operational or payment-related.

## Risks / Trade-offs

- [Risk] Existing data may contain status values that do not align with newly enforced enums/defaults.  
  Mitigation: validate and normalize in DAL/DTO boundaries; surface clear validation errors for invalid updates.

- [Risk] Multi-step create UI can drift from server-required fields and cause failed submissions.  
  Mitigation: define one shared server input contract (zod) and keep client form sections mapped to explicit DTO fields.

- [Risk] Audit log growth could increase storage and query cost over time.  
  Mitigation: keep payload minimal (action, actor, before/after summary, timestamp) and index by parcel and created time.

- [Risk] Restricting cancellation may block urgent operations for other roles.  
  Mitigation: keep scope strict for now and handle expanded policy in a separate, explicit change.

## Migration Plan

1. Add/confirm parcel feature slice and implement read paths for admin dashboard list/detail.
2. Implement create/update server actions with zod validation and server-enforced defaults.
3. Add transactional DAL writes covering parcel, payment record, and audit log records.
4. Add authorization guard for cancellation status changes.
5. Integrate admin dashboard forms/pages for create and update.
6. Validate behavior with targeted tests and manual role-based verification.

Rollback strategy:
- Revert UI routes/actions if needed; data created remains valid because no destructive schema change is introduced in this proposal.

## Open Questions

- Should cancelled parcels allow further payment-status edits by admin, or should non-terminal fields be frozen after cancellation?
- Should the create flow enforce a required initial payment record row for every parcel, or allow deferred record creation in specific operational cases?
