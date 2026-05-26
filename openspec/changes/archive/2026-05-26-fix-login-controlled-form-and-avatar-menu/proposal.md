## Why

The login form currently mixes `useActionState` with uncontrolled inputs, which can trigger React's uncontrolled-to-controlled warning and makes the error-state UX less predictable. The authenticated dashboard header also exposes only static name and role text, which leaves the logout control visually disconnected and misses a clearer account entry point.

## What Changes

- Update the login experience to use explicit controlled inputs for username and password while preserving the existing server action flow and validation messaging.
- Preserve submitted field values and pending-state behavior without relying on `defaultValue`.
- Replace the static dashboard user text block with an avatar-triggered shadcn dropdown menu.
- Generate a deterministic avatar from `https://www.facehash.dev/` for the signed-in user at render time without storing uploaded avatar data.
- Move the logout action into the avatar dropdown while keeping the authenticated header compact on desktop and mobile.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `auth-session-access`: refine login form state handling and authenticated dashboard account controls to use controlled credentials input, generated avatars, and avatar-menu logout access.

## Impact

- Affects `src/features/auth/components/login-form.tsx` and potentially related auth form support code.
- Affects `src/components/layout/dashboard-shell.tsx` and any logout/account-menu wiring required by Better Auth in the dashboard shell.
- Reuses shadcn/ui primitives for dropdown-menu and avatar presentation.
- Introduces runtime use of FaceHash-generated avatar URLs without adding stored user avatar data or a new persistence model.
