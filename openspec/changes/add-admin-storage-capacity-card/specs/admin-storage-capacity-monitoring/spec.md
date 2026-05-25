## ADDED Requirements

### Requirement: Admin overview shows combined storage capacity card

The system SHALL show a storage capacity card on the admin overview page only for super admins, summarizing Supabase database usage and Cloudflare R2 total storage usage in one card.

#### Scenario: Super admin overview displays both storage metrics

- **WHEN** a super admin opens `dashboard`
- **THEN** the system shows one storage capacity card alongside the other admin overview cards
- **AND** the card includes a Supabase database row and a Cloudflare R2 row
- **AND** each row shows the storage label, used amount, reference limit, and a progress indicator for percent used

#### Scenario: Non-super-admin roles do not see the storage card

- **WHEN** an office admin, merchant, or rider opens their dashboard view
- **THEN** the system does not render the storage capacity card

#### Scenario: Provider usage is normalized against reference limits

- **WHEN** the storage capacity card is rendered
- **THEN** the system uses live provider-reported usage values
- **AND** the progress denominator comes from server configuration when the provider does not expose a live hard-capacity value

#### Scenario: Cloudflare R2 row reflects dashboard-style total storage

- **WHEN** the storage capacity card renders the Cloudflare R2 row
- **THEN** it shows the current total storage value derived from Cloudflare’s storage metrics
- **AND** it does not present that current total-storage value as an exact monthly GB-month billing calculation

#### Scenario: Cloudflare free-tier reference limit is used for MVP progress

- **WHEN** the admin account is using the R2 free tier for this MVP
- **THEN** the Cloudflare R2 progress bar compares current total storage against a 10 GB reference limit

#### Scenario: Compact card follows dashboard stats-card pattern

- **WHEN** the storage capacity card is rendered on the admin overview page
- **THEN** the system uses the established compact stats-card visual language
- **AND** the card does not show a trial badge or scheduled refresh badge for this MVP

### Requirement: Admin can manually refresh storage capacity values

The system SHALL let a super admin manually fetch the latest storage usage values from the storage card.

#### Scenario: Super admin refreshes storage capacity card

- **WHEN** a super admin clicks the refresh control on the storage capacity card
- **THEN** the system requests fresh Supabase database and Cloudflare R2 usage values from the server
- **AND** the card updates the displayed used amount, reference limit, and progress values after the refresh completes

#### Scenario: Refresh keeps both metrics in one card

- **WHEN** the manual refresh completes successfully
- **THEN** the system updates both storage rows within the same storage capacity card
- **AND** the admin remains on the dashboard page without navigating away

### Requirement: Storage capacity loading is admin-safe and resilient

The system SHALL protect storage capacity loading on the server and keep the admin overview usable when storage stats cannot be fetched.

#### Scenario: Supabase usage is loaded from the documented privileged metrics surface

- **WHEN** the server loads Supabase database usage for the card
- **THEN** it uses the Supabase privileged metrics endpoint with server-side credentials

#### Scenario: Cloudflare R2 usage is loaded from analytics rather than a quota endpoint

- **WHEN** the server loads Cloudflare R2 usage for the card
- **THEN** it uses a Cloudflare server-side analytics integration
- **AND** it derives the dashboard-style total storage value from storage analytics fields rather than a quota endpoint

#### Scenario: Non-super-admin users cannot access storage stats

- **WHEN** an office admin, merchant, or rider attempts to load or refresh storage capacity data
- **THEN** the system rejects the request before returning storage metrics

#### Scenario: One or both storage providers fail to return stats

- **WHEN** the server cannot fetch Supabase database usage data, Cloudflare R2 usage data, or both
- **THEN** the dashboard still renders the storage capacity card shell
- **AND** the affected storage row shows an unavailable or failed-to-refresh state instead of stale success data
