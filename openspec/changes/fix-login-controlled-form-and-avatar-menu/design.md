## Context

Parcel Flow uses a Better Auth server action for username/password login and renders the authenticated dashboard shell as a server component. The current login form uses `useActionState` but leaves the inputs uncontrolled, which is a fragile fit for a form that re-renders from server-returned validation state. The current dashboard header renders static user name and role text, while logout is expected elsewhere and there is no consolidated account entry point.

This change stays within the existing Next.js monolith, feature-sliced structure, and shadcn/ui usage rules. It must not introduce persisted avatar storage, extra backend services, or a separate auth layer.

## Goals / Non-Goals

**Goals:**

- Remove uncontrolled-to-controlled login form behavior by making the credential fields explicitly client-controlled.
- Preserve the current Better Auth server action contract and role-based post-login redirects.
- Add a compact authenticated account control that shows a generated FaceHash avatar and exposes logout through a shadcn dropdown menu.
- Keep the dashboard shell compatible with server-rendered user/session loading.

**Non-Goals:**

- Do not add avatar upload, avatar persistence, or user profile editing.
- Do not redesign the broader login page layout or dashboard navigation.
- Do not change role labels, role landing paths, or permission rules.
- Do not introduce a new dependency if the existing stack can support the dropdown/avatar behavior.

## Decisions

### Use local component state for login field ownership

The login form should hold `username` and `password` in client state and bind them through `value` and `onChange`. `useActionState` should continue to drive submit status and server-returned error messaging, but the component should synchronize returned username values back into local state after failed submissions.

Alternative considered: keep uncontrolled inputs and only swap `defaultValue` handling. That leaves the current warning-prone ownership model in place and makes future validation UX harder to reason about.

### Keep the login server action shape stable

`loginAction` already validates with Zod, returns the submitted username on error, and redirects on success. The change should keep that contract stable so only the form component needs to adopt controlled field behavior, with at most small state-shape additions if preserving password state across a failed round-trip becomes necessary.

Alternative considered: move all login validation client-side. That would duplicate server validation and weaken the current server-authoritative auth flow.

### Generate the dashboard avatar from deterministic user identity data

The dashboard shell should derive a FaceHash URL from stable user data already available in session context, such as user ID or username, and render it through shadcn-compatible avatar UI. This provides a repeatable visual identity without storing image assets or extending the data model.

Alternative considered: continue showing only text identity. That keeps the header less discoverable and does not solve the request to consolidate logout under an avatar interaction.

### Use a dedicated account-menu client component for logout interaction

Because the shell itself is server-rendered but the dropdown and logout interaction are user-driven, the account trigger/menu should live in a small client component that receives the current user display data as props. That component should use shadcn dropdown menu primitives and own the sign-out interaction.

Alternative considered: convert the full dashboard shell to a client component. That would unnecessarily expand the client boundary around navigation and authenticated layout rendering.

### Implement explicit Better Auth sign-out wiring

The repository does not currently expose a logout helper, so this change should add one in the auth feature or lib layer using Better Auth’s supported sign-out path for Next.js. The dropdown menu should call that path and return the user to the login route or public landing route after session termination.

Alternative considered: leave logout as a plain link or hidden control elsewhere. That would not meet the requested header UX and would keep account actions fragmented.

## Risks / Trade-offs

- Controlled password input can be cleared unexpectedly after server responses -> Keep password state local and only reset it intentionally after success or explicit UX choice.
- FaceHash availability or latency can affect avatar rendering -> Use avatar fallback initials so the menu remains usable if the external image is slow or unavailable.
- Mixing server-rendered shell data with client logout controls can create boundary friction -> Pass only the minimal serialized user fields into a dedicated client account-menu component.
- Better Auth sign-out integration may require a client helper or server route convention not yet present in the repo -> Isolate the logout wiring in feature/lib code so the header component stays simple.
