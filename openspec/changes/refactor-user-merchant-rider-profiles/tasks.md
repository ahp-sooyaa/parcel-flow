## 1. Schema And Migration

- [x] 1.1 Audit current `app_users`, `merchants`, `riders`, and township-related fields against the updated ERD and confirm the final column contract for this phase
- [x] 1.2 Update [`src/db/schema.ts`](/Users/aunghtet/Personal/parcel-flow/src/db/schema.ts) so `app_users` holds shared identity fields, `merchants` / `riders` become required 1:1 profile tables keyed by app user ownership, and `townships` is added as a master table
- [x] 1.3 Generate a new Drizzle migration from the schema diff without editing existing migration files
- [x] 1.4 Review the generated migration to confirm it creates township relations correctly and safely handles dropping legacy merchant and rider rows before obsolete columns and constraints are removed

## 2. Server Queries And DTO Refactor

- [x] 2.1 Update merchant DAL, DTO, and helper logic to read shared human/contact fields from `app_users`, merchant business fields from `merchants`, and township labels from `townships`
- [x] 2.2 Update rider DAL, DTO, and helper logic to read shared human/contact fields from `app_users`, rider operational fields from `riders`, and township labels from `townships`
- [x] 2.3 Update auth/session context joins so linked merchant resolution uses the new required merchant ownership relationship
- [x] 2.4 Remove or replace old linked-user lookup helpers that assume merchant and rider rows can exist without an owning app user
- [x] 2.5 Add township feature DAL, DTO, and validation helpers for list and create flows

## 3. Unified User Provisioning

- [x] 3.1 Expand the user create zod schema and server utils to accept role-specific merchant and rider profile fields with documented defaults and township identifiers from the township table
- [x] 3.2 Refactor [`src/features/users/server/actions.ts`](/Users/aunghtet/Personal/parcel-flow/src/features/users/server/actions.ts) so merchant-role and rider-role user creation also writes the required profile row with compensating cleanup on failure
- [x] 3.3 Keep provisioning explicit and auditable by allowlisting only supported fields, preserving current password-generation and reset-required behavior, and defaulting `riders.is_active` to active
- [x] 3.4 Update audit metadata and route revalidation so unified user provisioning keeps user, merchant, and rider screens consistent after creation

## 4. Township UI

- [x] 4.1 Add dashboard township list and create pages using the township table fields only
- [x] 4.2 Add a township sidebar navigation entry and keep it visible without authorization-based menu checks for now
- [x] 4.3 Wire township create success paths to refresh township list and downstream form option usage

## 5. UI And Flow Cleanup

- [x] 5.1 Refactor the user create form to conditionally show merchant or rider profile fields based on selected role
- [x] 5.2 Load merchant and rider township options from the township table instead of static constants
- [x] 5.3 Remove standalone merchant and rider create entry points so staff use the unified user creation workflow
- [x] 5.4 Update list pages, empty states, and navigation links that currently point to separate merchant or rider create screens

## 6. Validation And Regression Checks

- [x] 6.1 Verify admin creation for office admin, merchant, and rider roles, including defaulted merchant and rider profile values and rider operational active default
- [x] 6.2 Verify merchant and rider list or detail views still return correct shared identity data and township labels after the schema refactor
- [x] 6.3 Verify township list and create flows work from the dashboard sidebar entry
- [x] 6.4 Verify self-scope merchant access still resolves correctly through the new ownership key
- [x] 6.5 Document any follow-up authorization or permission refactor work as a separate change rather than expanding this implementation scope
