# AGENTS.md

## Mission

Build a practical internal delivery-management web app for a Myanmar delivery business.

Prioritize:

- security
- consistency
- operational clarity
- accounting correctness
- maintainability

## Architecture

- Use a full-stack Next.js monolith.
- Do not introduce extra backend services or architectural layers unless explicitly requested.
- Use feature-sliced structure consistently.

Required structure:

- src/app
- src/components/layout
- src/components/shared
- src/components/ui
- src/features/<feature>/components
- src/features/<feature>/server/actions.ts
- src/features/<feature>/server/dal.ts
- src/features/<feature>/server/dto.ts
- src/features/<feature>/server/utils.ts
- src/lib
- src/db
- src/proxy.ts

- Use `proxy.ts`, not `middleware.ts`.
- `src/components/ui` is for shadcn/ui components only.
- `src/components/layout` is for app shell/layout components.
- `src/components/shared` is for reusable app-specific shared components.

## Implementation rules

- Keep patterns consistent across all features.
- Use server actions for mutations.
- Validate input on the server with zod.
- Keep business logic out of React UI components.
- Put database access in `server/dal.ts`.
- Put safe response shaping in `server/dto.ts`.
- Put feature-specific helpers in `server/utils.ts`.
- Do not place raw DB queries in client components.
- Do not introduce repository/service/mapper/use-case abstractions unless explicitly requested.

## Database workflow

- Use the Drizzle schema as the source of truth.
- For schema changes, update the schema code first, then run Drizzle generate + migrate.
- Do not hand-write migration files.
- Do not ask for raw SQL migration files to be authored manually.
- When a schema change is needed, write the schema and generate the migration file from it.

## Auth and authorization

- No public signup.
- Users are created only by authorized admins.
- Use Supabase Auth for identity.
- Store app roles, permissions, and user status in the application database.
- Enforce authorization on the server.
- Never trust client-provided role, permission, or ownership data.
- Authenticated does not mean authorized.

## Security

- Fail closed by default.
- Never expose secrets to the client.
- Never expose unnecessary sensitive fields to the client.
- Validate file type and size on the server for uploads.
- Keep money-related logic explicit and easy to audit.
- COD is not company revenue.

## Coding style

- Prefer explicit, boring, maintainable code over clever abstractions.
- Use domain-first naming.
- Make small, reviewable changes.
- Follow existing project patterns when adding new code.
