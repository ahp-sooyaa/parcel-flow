## Context

Parcel Flow already supports rider failure reporting and admin failure resolution, but it currently stores only one nullable text `delivery_failure_note` on each parcel. That model cannot preserve multiple failure attempts across retries and does not explicitly capture whether the current note still needs admin review. The requested change crosses the database schema, parcel server logic, rider parcel actions, and admin parcel-list filtering, so it needs a single design that keeps the existing Next.js monolith and parcel feature slice aligned.

## Goals / Non-Goals

**Goals:**

- Store failure notes as JSONB history entries instead of a single text field.
- Derive a single active unresolved failure note for rider and admin workflows.
- Append a new active note when a rider reports failure and mark that active note inactive when an admin resolves to `postpone` or `canceled_returned`.
- Gate rider parcel actions from the derived active-note state.
- Add an admin `Need review` list filter driven by parcels with an active failure note.
- Preserve existing permission checks, assignment clearing, and status transition behavior.

**Non-Goals:**

- No new parcel status values beyond the existing `postpone` and `canceled_returned`.
- No separate failure-note table or new backend service.
- No bulk admin failure resolution workflow.
- No redesign of the rider/admin dialog layouts beyond the button and filter behavior needed for this feature.

## Decisions

1. Store `delivery_failure_note` as a JSONB array of note objects.

   The column will remain named `delivery_failure_note` to minimize cross-cutting rename churn, but its type will become JSONB and store an array ordered oldest-to-newest. Each entry should contain the minimum workflow fields: `note` and `status`, where `status` is `active` or `inactive`. The append order becomes the history source of truth, so the active unresolved note is the latest entry with `status = active`. A separate table was considered, but it adds joins and extra repository structure for a workflow that remains parcel-scoped.

2. Backfill legacy text notes into one JSONB entry during migration.

   Existing non-empty text notes should be converted into a one-item JSONB array. The migration should mark the converted entry as `active` only when the parcel is still in the unresolved failure-review state that already exists in the product flow, meaning `status = on_the_way`, `rider_id` is set, and the old text note is non-empty. All other converted notes should become `inactive` so historical data remains visible without polluting the new review queue.

3. Centralize active-note derivation in parcel server utilities and DTO mapping.

   Both rider and admin surfaces need the same answer to “does this parcel currently have an active failure note?” The DAL/DTO layer should expose a normalized shape such as `failureNotes` plus `activeFailureNote`, rather than letting each component parse raw JSONB independently. This avoids duplicating JSON parsing rules across server actions and UI components and keeps client components free of business logic.

4. Keep rider failure reporting append-only.

   When a rider reports failure for an `on_the_way` parcel with no active note, the system should append a new JSONB entry with `status = active` instead of mutating older entries. This preserves retry history across multiple failed attempts. While an active note exists, the rider flow becomes review-only: show `View Failure Note`, hide `Report Failure`, and hide `Mark Delivered`. Re-editing an active note was considered, but it weakens the “one reported failure awaiting review” lifecycle and is not required by the request.

5. Resolve failure notes inside the existing admin failure decision transaction.

   The existing admin resolution actions already update parcel status, clear rider assignment, and write status logs. The same transaction should also mark the current active failure note entry inactive before saving the parcel. This keeps the parcel status decision and note-resolution state in sync and prevents the new `Need review` queue from showing stale parcels after resolution.

6. Drive the admin `Need review` tab from active-note state, not only parcel status.

   The new admin tab should filter parcels that currently have an active failure note. In normal operation these will also be `on_the_way`, but the filter should be based on the derived active note so the queue remains faithful to the new note lifecycle rather than re-encoding assumptions in the UI. The existing warning/review affordance can continue to rely on the same derived field.

## Risks / Trade-offs

- JSONB shape drift across code paths -> Define a shared Zod schema and DTO mapping for failure note entries before any read or write.
- Legacy backfill misclassifies unresolved notes -> Use the existing unresolved workflow state (`on_the_way` with assigned rider and non-empty note) as the only condition for `active`; default all other migrated notes to `inactive`.
- Multiple active notes caused by buggy writes -> Server actions should reject new rider failure submissions when an active note already exists and admin resolution should update only the latest active entry.
- UI filter mismatch between rider and admin surfaces -> Have both surfaces consume the same `activeFailureNote` field from parcel DTOs instead of recomputing from raw JSON.
- Migration rollback complexity -> Provide a reversible migration that can collapse JSONB arrays back to the latest note text only if rollback is required before new writes depend on note history.

## Migration Plan

1. Add a schema migration that converts `parcels.delivery_failure_note` from nullable text to nullable JSONB, preserving the existing column name.
2. Backfill existing non-empty text values into JSONB arrays with one `{ note, status }` object, using the unresolved-state rule to choose `active` vs `inactive`.
3. Update the Drizzle schema and parcel-side Zod helpers to treat the column as a JSONB note-entry array.
4. Update rider failure report and admin failure resolution actions to append and deactivate note entries using one shared utility path.
5. Update parcel DTOs and UI components to consume `activeFailureNote` and expose the `Need review` admin tab.
6. Validate with tests around migration, rider action gating, admin filtering, and resolution side effects before deploy.

Rollback strategy:

- Before rider writes depend on multiple-entry history in production, rollback can restore the previous text contract by converting each JSONB array to its latest note text or `NULL`.
- After production starts using multiple entries, rollback should be avoided without a data-preserving forward fix because note history would be lost.

## Open Questions

- None at proposal time. The request is specific enough to proceed with implementation once approved.
