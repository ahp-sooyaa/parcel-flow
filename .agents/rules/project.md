# Antigravity / AI Coding Rules

## 1. Core Architecture & Routing
- ALWAYS use the Next.js App Router within the `src` directory.
- DEFAULT to React Server Components (RSC).
- ONLY use Client Components (`"use client"`) for interactivity.
- STRICTLY adhere to a Feature-Sliced folder structure (organize by domain/feature, e.g., `src/features/blog`, `src/features/admin`).
- ALWAYS use strictly typed TypeScript for all files, components, and functions.
- IMPLEMENT React Suspense and Next.js special files (`loading.tsx`, `error.tsx`, `not-found.tsx`) for granular loading states and graceful error handling. Avoid manual `useState` loading flags.
- ALWAYS use the `use cache` directive for caching. NEVER use the legacy `fetch()` cache options (`cache: 'force-cache'`, `next: { revalidate }`) or `unstable_cache`. The `use cache` directive is the canonical caching primitive for this project.

## 2. Component Patterns & React Best Practices
- NEVER use inline event handlers (e.g., `onClick={() => doSomething()}`). ALWAYS extract event handlers into named, separate functions.
- AVOID prop drilling. ALWAYS use the Composition Pattern (passing components as `children` or props) or React Context for deep state sharing.
- IMPLEMENT the "Donut Pattern" when mixing client and server components: Extract the interactive shell into a Client Component and pass the Server Component inside it via composition (`children`).

## 3. Data Access & State Mutation
- IMPLEMENT the DAL (Data Access Layer) for all database queries.
- The DAL must NEVER return raw database objects directly to the UI or Server Actions. ALWAYS pass the DAL database result through a dedicated DTO (Data Transfer Object) mapping function to strip sensitive fields before returning the data.
- NEVER perform data mutations outside of Server Actions. All data mutations must occur in dedicated server action files.
- ALWAYS use `next-safe-action` for defining and executing Server Actions. Validate all inputs using Zod.

## 4. Database & ORM (Drizzle)
- NEVER write the entire database schema in a single `schema.ts` file.
- ALWAYS create one file per table (e.g., `src/db/schema/users.ts`, `src/db/schema/posts.ts`).
- Export all individual table schemas from an `index.ts` file in the `schema` directory.
- Treat Supabase strictly as a PostgreSQL database; handle all authentication and authorization via BetterAuth.

## 5. Tooling Constraints & Code Style
- ALWAYS use `bun` for installing packages, running scripts, and testing. Do not use npm, yarn, or pnpm.
- Enforce consistent bracket usage and spacing.
- Ensure no variables or constants are declared but left unused.

## 6. Documentation & MCP Usage (`context7`)
- You have access to the `context7` MCP to fetch up-to-date documentation and code context. You have a strict limit of 1000 requests, so use it judiciously.
- DO NOT use `context7` for standard React, standard Next.js routing, or basic TypeScript logic.
- ALWAYS use `context7` to look up specific exports, component props, or API schemas for the following rapidly changing libraries before generating code:
  1. `lucide-react` (to verify exact icon export names, e.g., `BookMedia`)
  2. `shadcn/ui` (to get correct component structures and variants)
  3. `better-auth` (to verify authentication/authorization methods, especially the admin package)
  4. `drizzle-orm` (if unsure about specific Postgres schema syntax)
- If you are ever unsure about a third-party library's API, query `context7` rather than guessing to prevent hallucinated exports.

## 7. Workflow & Autonomous Execution (Verification)
- TERMINAL VERIFICATION: Before concluding any code generation, you MUST autonomously execute `bun run verify` (which runs TypeScript checks, Oxlint, and Next.js build) in the terminal.
- SELF-CORRECTION: If the terminal outputs any Oxlint, TypeScript (`tsc`), or build errors (especially Next.js 'module not found' errors), read the logs and fix the imports or logic before reporting completion. Do not ask for permission.

## 8. Security & Vulnerability Prevention
- **Strict Authorization Check**: ALWAYS verify the user's session and role (via `better-auth`) at the very beginning of *every* Server Action and private API route. Never assume a request is authorized just because it comes from the UI.
- **IDOR (Insecure Direct Object Reference) Prevention**: When mutating data (updating or deleting a blog post), ALWAYS verify that the currently authenticated user is the actual owner of that specific database record, or that they have an Admin role.
- **Data Sanitization (XSS Prevention)**: Because the app uses Tiptap/Turndown for rich text, you MUST sanitize all user-generated HTML and Markdown on the server before saving it to the database, and safely parse it when rendering.
- **Secure File Handling (AWS S3)**: NEVER set S3 buckets to public access. ALWAYS generate temporary Pre-Signed URLs on the server for both uploading images and retrieving them.
- **Secret Management**: NEVER hardcode API keys, database passwords, or secrets in the code. ALWAYS use `process.env`.
- **Environment Variable Discipline**: NEVER prefix an environment variable with `NEXT_PUBLIC_` unless it is explicitly required by the client (e.g., a public analytics key). Keep all database and auth secrets purely on the server.

## 9. Caching Strategy (`use cache`)
- `cacheComponents: true` is set as a top-level option in `next.config.ts` (it is stable, NOT experimental). This enables Partial Prerendering and makes `use cache` the ONLY approved caching mechanism.
- ALWAYS add `"use cache"` at the top of any Server Component, async function, or data-fetching utility that returns data that does not need to be fresh on every request.
- ALWAYS pair `"use cache"` with an explicit `cacheLife` call to declare TTL semantics. Use semantic profiles: `"seconds"`, `"minutes"`, `"hours"`, `"days"`, `"weeks"` or define a custom profile in `next.config.ts`.
- ALWAYS use `cacheTag(...)` on cached functions or components when the data is tied to a specific resource (e.g., a post ID, user ID) so it can be surgically invalidated via `revalidateTag(...)` in Server Actions.
- NEVER use legacy caching APIs: no `fetch()` cache options (`cache: 'force-cache'`, `next: { revalidate }`), no `unstable_cache`, and no `revalidatePath` for targeted invalidation. Prefer `revalidateTag` for precision.
- NEVER place `"use cache"` on a component or function that reads request-time data (cookies, headers, search params) — these must remain dynamic. Keep data-fetching logic separated from request context.
- ALWAYS ensure `next.config.ts` includes the following before generating any cached components:
  ```ts
    const nextConfig: NextConfig = {
      cacheComponents: true,
    }
  ```
