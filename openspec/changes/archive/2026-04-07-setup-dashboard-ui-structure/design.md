## Context

The project is a full-stack Next.js monolith for an internal delivery management app and follows strict folder and feature boundaries from `AGENTS.md`. Current work is a UI-first scaffold that establishes route groups and dashboard shell structure for authenticated internal users, with permission-aware user management forms.

The requested route structure introduces:
- `(auth)/sign-in`
- `(dashboard)` pages for `dashboard`, `users`, `merchants`, `riders`, `parcels`, and `unauthorized`
- shared dashboard layout under `(dashboard)/layout.tsx`

This phase is intentionally focused on stable structure and navigation clarity, not backend behavior or database mutations.

## Goals / Non-Goals

**Goals:**
- Provide clear, maintainable dashboard route scaffolding for core internal app sections.
- Implement usable UI for sign-in and user creation pages.
- Ensure user creation form captures role and permission inputs explicitly.
- Add branded fallback experiences for not-found and runtime error states in dashboard routes.
- Keep implementation consistent with required component directories (`layout`, `shared`, `ui`) and security-oriented project conventions.

**Non-Goals:**
- Implementing full authentication flow, session handling, or Supabase server logic.
- Implementing create-user server actions, DAL, or persistence in this change.
- Finalizing role-permission policy model or permission matrix semantics.
- Building feature-complete CRUD pages for dashboard sections beyond placeholders.

## Decisions

### Decision: Use route-group layout as the dashboard shell boundary
The `(dashboard)/layout.tsx` file will own sidebar/menu and identity chrome. Child pages remain focused on content. This keeps navigation logic centralized and consistent across all internal pages.

Alternatives considered:
- Repeating sidebar per page: rejected due to duplication and drift risk.
- Global app-level layout for both auth and dashboard: rejected to avoid forcing dashboard chrome onto sign-in.

### Decision: Keep `sign-in` and `users/create` as concrete pages, others as placeholders
Only `sign-in/page.tsx` and `users/create/page.tsx` will contain real UI in this change. Remaining pages render `coming soon...` to preserve route compatibility without overcommitting implementation details.

Alternatives considered:
- Implement all pages fully now: rejected due to scope expansion.
- Leave missing pages unimplemented: rejected because it breaks navigation and onboarding flow.

### Decision: Model permissions in the create-user UI as explicit form fields
The create-user page includes dedicated `role` and `permissions` fields to align with permission-based authorization requirements and make intent explicit for later server-side validation.

Alternatives considered:
- Role only, infer permissions automatically: rejected because requirement explicitly calls for permission field.
- Freeform unstructured JSON permissions input: rejected for poor usability and error risk.

### Decision: Place shared shell components in `src/components/layout` and reusable app-specific bits in `src/components/shared`
This preserves structural constraints and keeps `src/components/ui` reserved for shadcn primitives only.

Alternatives considered:
- Put all components in feature folders: rejected because shell components are cross-feature.
- Put app shell into `shared`: rejected because layout-specific concerns belong in `layout`.

### Decision: Add dashboard-level `not-found.tsx` and `error.tsx` files
Fallback pages will be scoped under `src/app/(dashboard)` so internal users see consistent app-branded recovery screens when a route is missing or an unexpected rendering error occurs.

Alternatives considered:
- Use Next.js default fallback pages: rejected to avoid generic UX and missing operational navigation context.
- Place a global root-level fallback only: rejected because dashboard users need section-aware recovery actions.

## Risks / Trade-offs

- [Risk] Placeholder pages may be mistaken for complete features.  
  → Mitigation: keep placeholder copy explicit (`coming soon...`) and track follow-up tasks per feature.

- [Risk] UI-only role/permission fields can create false confidence without server enforcement.  
  → Mitigation: include explicit task to add server-side zod validation and authorization checks in subsequent implementation step.

- [Risk] Early navigation labels might diverge from eventual product language.  
  → Mitigation: centralize labels in one sidebar config so updates are low-friction.

- [Risk] If app shell structure is not reused consistently, future pages may bypass authorization UX patterns.  
  → Mitigation: require all internal sections to live under `(dashboard)` route group and layout.

- [Risk] Error boundary UI can hide actionable debugging details if overly simplified.  
  → Mitigation: keep user-facing copy concise but include retry and navigation actions while preserving server logs for diagnostics.

## Migration Plan

1. Add route directories and `page.tsx` files under `(auth)` and `(dashboard)`.
2. Add `(dashboard)/layout.tsx` and extract sidebar/identity pieces into layout/shared components as needed.
3. Add functional UI for sign-in and user create pages.
4. Add dashboard-scoped `not-found.tsx` and `error.tsx` fallback pages.
5. Add placeholders for remaining pages.
6. Run lint/typecheck and verify route rendering.

Rollback:
- Revert this change set to remove route scaffolding if it blocks existing navigation.
- Because no schema or persistence changes are included, rollback is code-only and low-risk.

## Open Questions

- What exact role enum should be used for initial role select options?
  Answer: Use four roles for the initial implementation:
  - `super_admin`
  - `office_admin`
  - `rider`
  - `merchant`

- Should permissions be selected from predefined checkboxes or entered as tokens in this first iteration?
  Answer: Use predefined permission checkboxes in the first iteration.

- Should unauthorized users redirect automatically to `(dashboard)/unauthorized`, or will that behavior be introduced with auth guards later?
  Answer: Unauthorized redirect behavior will be introduced later together with auth guards.
