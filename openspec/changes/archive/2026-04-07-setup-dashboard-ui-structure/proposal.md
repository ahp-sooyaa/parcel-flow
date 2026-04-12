## Why

The delivery operations team needs a clear, permission-oriented dashboard foundation before feature logic can be implemented safely. Establishing the route structure, navigation shell, and baseline pages now reduces rework and gives every role a predictable starting point.

## What Changes

- Create route groups and dashboard page structure for auth and internal app sections.
- Add a dashboard layout shell with sidebar navigation, app name, and signed-in user display area.
- Implement `sign-in/page.tsx` and `users/create/page.tsx` as functional UI pages.
- Include role and permission fields on user creation UI to support permission-based authorization flows.
- Add placeholder `page.tsx` files for non-implemented sections with `coming soon...` content.
- Add custom UI fallbacks using `not-found.tsx` and `error.tsx` for dashboard-facing route failures.

## Capabilities

### New Capabilities
- `auth-sign-in-page`: Render a structured sign-in page under the auth route group for internal user access.
- `dashboard-shell-navigation`: Provide a reusable dashboard layout with sidebar links and identity context.
- `user-management-page-scaffold`: Deliver user creation UI with role and permission inputs plus placeholder management pages.
- `dashboard-ui-fallback-boundaries`: Provide dashboard-level not-found and error boundary screens with recovery navigation.

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `src/app/(auth)/sign-in/page.tsx`
  - `src/app/(dashboard)/layout.tsx`
  - `src/app/(dashboard)/**/page.tsx`
  - `src/app/(dashboard)/not-found.tsx`
  - `src/app/(dashboard)/error.tsx`
  - shared layout/navigation components under `src/components/layout` and `src/components/shared` as needed
- No backend API or database schema changes in this change.
- Establishes UI contract for future authorization-aware server actions and DAL work.
