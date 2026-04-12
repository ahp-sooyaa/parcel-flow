## Why

Rider management is currently blocked by a placeholder page, forcing operations to track riders outside the system. We need the same internal workflow quality we already have for merchants so office staff can list and register riders with permission-controlled, auditable actions.

## What Changes

- Add a rider list page under dashboard with server-side search, rider summary fields, and permission-gated access.
- Add a rider create page and form that follows the merchant create flow and validates all submitted fields on the server.
- Add rider server DAL/action/DTO/utils modules in `src/features/rider/server/*` and keep DB access out of UI.
- Add rider UI components in `src/features/rider/components` and wire routes under `src/app/(dashboard)/dashboard/riders/*`.
- Reuse the existing static township options for now (same current approach as merchant) and explicitly defer township table integration.
- Record audit logging and route revalidation for rider creation so operational changes are traceable and visible immediately.

## Capabilities

### New Capabilities
- `rider-management`: Internal rider list and rider profile creation with permission checks, server validation, and auditable mutations.

### Modified Capabilities
- None.

## Impact

- Affected code: `src/app/(dashboard)/dashboard/riders`, `src/features/rider/*`, and shared auth/audit integration points.
- APIs/actions: new rider create server action and rider list/read DAL queries.
- Data model usage: add `riders` table in Drizzle schema (linked to `app_users`) and then generate/migrate via Drizzle workflow; no township table integration in this change.
- Dependencies/systems: no new external services; follows current Next.js monolith and existing RBAC model.
