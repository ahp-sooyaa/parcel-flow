# AGENTS.md

## Purpose

This file defines the default engineering rules for Codex and other coding agents working in this repository.

These rules apply unless the user explicitly overrides them.

---

## Architecture

- Use a full-stack Next.js monolith.
- Do not introduce extra backend services or architectural layers unless explicitly requested.
- Use feature-sliced structure consistently.

Required structure:

- `src/app`
- `src/components/layout`
- `src/components/shared`
- `src/components/ui`
- `src/features/<feature>/components`
- `src/features/<feature>/server/actions.ts`
- `src/features/<feature>/server/dal.ts`
- `src/features/<feature>/server/dto.ts`
- `src/features/<feature>/server/utils.ts`
- `src/lib`
- `src/db`
- `src/proxy.ts`

Rules:

- Use `proxy.ts`, not `middleware.ts`.
- `src/components/ui` is for shadcn/ui components only.
- `src/components/layout` is for app shell and layout components only.
- `src/components/shared` is for reusable app-specific shared components.
- Keep feature-specific UI inside `src/features/<feature>/components`.
- Keep feature-specific server logic inside `src/features/<feature>/server`.
- Do not place business logic in `src/components`.
- Do not create generic `services`, `managers`, `helpers`, or `utils` folders at the root unless explicitly requested.

---

## Stack Expectations

- Framework: Next.js App Router
- Language: TypeScript
- Styling: Tailwind CSS
- UI library: shadcn/ui
- Validation: Zod
- Database access: Drizzle ORM
- Authentication: Better Auth

Rules:

- Prefer server components by default.
- Use server actions for protected mutations when appropriate.
- Perform permission checks on the server.
- Keep database access out of client components.
- Validate important inputs with Zod.

---

## Domain Notes

- Authentication user tables come from Better Auth.
- Domain docs may refer to the auth user table as `app_users` as a placeholder name.
- `financial_items` is used for both merchant settlement and rider payout flows.
- `is_received_by_office` is a boolean field.

---

## UI Rules

- Follow the product spec UI patterns.
- Use shadcn/ui components as much as possible before building custom UI from raw HTML and Tailwind CSS.
- If shadcn/ui already provides a suitable component pattern, use it. For example, use the shadcn sidebar component instead of building a sidebar from scratch.
- Use shadcn right-side sheets for create/edit flows where the spec says so.
- Use dialogs for small forms where the spec says so.
- Reuse shared app components before creating new ones.
- Do not place app-specific reusable components in `src/components/ui`.

---

## Coding Rules

- Prefer simple, explicit code over abstraction-heavy patterns.
- Keep functions focused and small when practical.
- Avoid premature generalization.
- Match existing naming and file placement conventions.
- Add comments only when they help explain non-obvious logic.
- Do not introduce new dependencies unless necessary.
- Avoid nested ternary operator.

---

## Data Access Rules

- Put schema and database setup in `src/db`.
- Put feature-specific queries and mutations in `src/features/<feature>/server/dal.ts`.
- Keep DTO mapping in `src/features/<feature>/server/dto.ts`.
- Keep feature-specific server helpers in `src/features/<feature>/server/utils.ts`.
- Do not bypass typed database access with ad hoc raw queries unless necessary.

---

## File Creation Rules

- Prefer extending existing features over creating parallel patterns.
- If a new feature is added, follow the same feature-sliced layout.
- Do not add `middleware.ts`.
- Do not add separate backend apps, microservices, or RPC layers unless explicitly requested.

---

## Verification

- Run lint and typecheck after meaningful code changes when feasible.
- Keep changes aligned with:
  - `docs/parcel-flow-project-spec.md`
  - `docs/database-mermaid-diagram.md`
  - `docs/parcel-flow-technical-services.md`
