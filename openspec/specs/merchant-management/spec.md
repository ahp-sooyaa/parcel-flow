# merchant-management Specification

## Purpose
TBD - created by archiving change add-merchant-list-and-create. Update Purpose after archive.
## Requirements
### Requirement: Authorized staff can browse and search merchants
The system SHALL provide a merchant list view for authorized internal staff to browse and quickly find merchant records by operational identity fields.

#### Scenario: Staff opens merchant list successfully
- **WHEN** an authenticated user with merchant list permission requests the merchant list view
- **THEN** the system returns a paginated merchant list containing merchant summary fields needed for quick identification

#### Scenario: Staff searches merchants by name or phone
- **WHEN** an authorized staff user searches merchant list by merchant name or phone value
- **THEN** the system returns matching merchants ordered deterministically for fast operational lookup

#### Scenario: Merchant-role user cannot access merchant list
- **WHEN** an authenticated user without merchant list permission requests the merchant list view
- **THEN** the system denies access

### Requirement: Authorized staff can create merchant profiles
The system SHALL provide internal merchant profile creation through the admin user provisioning workflow, with server-side validation and explicit field allowlisting. Merchant profile creation SHALL create a required 1:1 merchant profile owned by the created app user rather than a standalone merchant record with optional user linkage.

#### Scenario: Staff creates merchant user and merchant profile with required fields
- **WHEN** an authorized admin submits valid merchant-role user creation data
- **THEN** the system creates the app user and the merchant profile, and stores only allowed merchant profile fields

#### Scenario: Merchant profile creation succeeds with only shared user fields and defaults
- **WHEN** an authorized admin submits valid merchant-role user creation data without optional merchant profile fields
- **THEN** the system creates the merchant profile successfully using the documented defaults and `null` optional values

#### Scenario: Unexpected merchant profile field is not written
- **WHEN** merchant-role user creation payload includes a field outside the allowed merchant profile contract
- **THEN** the system ignores or rejects the unexpected field and does not persist it

### Requirement: Merchant create input is validated and explicit
The system MUST validate merchant create input on the server and MUST reject invalid or unexpected payload fields.

#### Scenario: Invalid required field is rejected
- **WHEN** merchant create payload omits a required field such as merchant name
- **THEN** the system rejects the request with validation error details

#### Scenario: Unexpected field is not written
- **WHEN** merchant create payload includes a field outside the allowed create contract
- **THEN** the system ignores or rejects the unexpected field and does not persist it

### Requirement: Merchant records support future account and financial workflows
The system SHALL store merchant profile data in a way that supports later parcel linkage, payment or settlement views, and merchant self-scope authorization by requiring every merchant profile to belong to exactly one app user while keeping shared identity fields in `app_users`.

#### Scenario: Merchant profile is owned by app user
- **WHEN** a merchant profile is created
- **THEN** the system stores it with the related app user as the required owner record

#### Scenario: Shared contact data is read from app users
- **WHEN** merchant list or detail data needs human identity or contact values
- **THEN** the system reads shared fields such as full name, email, and phone from `app_users` instead of duplicating them in `merchants`

#### Scenario: Merchant cannot exist without linked app user
- **WHEN** a create or migration path attempts to persist a merchant profile without an owning app user
- **THEN** the system rejects the write or blocks migration until the ownership requirement is satisfied

#### Scenario: Merchant pickup township uses township table
- **WHEN** a merchant profile is created or read
- **THEN** the merchant pickup township is stored and resolved through the township table rather than a free-text township field

### Requirement: Merchant detail access supports self-scope for merchant role
The system SHALL define merchant-role detail access as self-scope only and SHALL allow parcel-related content to appear only when the requested merchant record belongs to the current merchant user. The system SHALL require `merchant.view` for merchant self-detail access and MUST NOT require `parcel-list.view` in order to show the merchant-owned parcel list inside that same detail page.

#### Scenario: Merchant owner opens own merchant detail with parcel list
- **WHEN** an authenticated merchant user with `merchant.view` requests the merchant profile linked to their account
- **THEN** the system allows access and returns the merchant detail view with only that merchant's related parcels

#### Scenario: Merchant user requests another merchant detail
- **WHEN** an authenticated merchant user requests a merchant detail page for a different merchant record
- **THEN** the system denies access to that route and does not return parcel data

#### Scenario: Merchant user without merchant view cannot access self detail
- **WHEN** an authenticated merchant-linked user without `merchant.view` requests their own merchant detail page
- **THEN** the system denies access even if the merchant linkage is valid

### Requirement: Merchant list and detail reflect business-only merchant fields
The system SHALL shape merchant list and detail responses so merchant-table fields contain business profile data only, while shared user identity data is joined from the related app user.

#### Scenario: Merchant list shows shop name from merchant profile
- **WHEN** an authorized internal user browses merchants
- **THEN** the list uses merchant business fields such as `shop_name` from the merchant profile row

#### Scenario: Merchant detail includes linked app user context
- **WHEN** an authorized internal user opens merchant detail
- **THEN** the detail response includes the owning app user's shared identity fields alongside merchant-specific profile fields

### Requirement: Merchant profiles can be edited from dedicated merchant routes
The system SHALL provide a merchant profile edit workflow at `/dashboard/merchants/[id]/edit`. The workflow MUST load merchant business-profile fields from merchant feature DAL functions, MUST validate updates on the server, and MUST keep shared identity fields separate from merchant-only fields.

#### Scenario: Admin edits merchant profile from dedicated route
- **WHEN** a super admin or office admin with `merchant.update` opens `/dashboard/merchants/[id]/edit` for an existing merchant user
- **THEN** the system SHALL load the merchant edit form with the current merchant profile values

#### Scenario: Merchant user edits owned merchant profile
- **WHEN** an authenticated merchant opens `/dashboard/merchants/[id]/edit` for their own merchant record
- **THEN** the system SHALL allow access to the edit workflow and persist valid merchant-only updates

#### Scenario: Merchant user cannot edit another merchant profile
- **WHEN** a merchant user opens `/dashboard/merchants/[id]/edit` for a merchant record they do not own
- **THEN** the system SHALL deny access to that route

### Requirement: Merchant detail views expose the edit entry point only when authorized
The system SHALL expose merchant profile edit entry points from merchant detail and user-management flows only to authorized actors. Unauthorized users MUST NOT receive edit controls or successful mutation paths.

#### Scenario: Admin sees merchant edit entry point
- **WHEN** a super admin or office admin can access a merchant detail page
- **THEN** the system SHALL display a path to the merchant edit workflow

#### Scenario: Merchant owner sees self edit entry point
- **WHEN** a merchant user can access their own merchant detail page
- **THEN** the system SHALL display a path to the merchant edit workflow for that same merchant record

### Requirement: Merchant detail exposes COD settlement entry points for authorized staff
The system SHALL show COD settlement entry points on merchant detail only to authorized internal users. The `COD in Held` stat card SHALL provide the settle action that enters settlement mode for the current merchant, and merchant detail SHALL expose settlement history for review and fulfillment.

#### Scenario: Authorized staff sees settle action on COD in Held
- **WHEN** an authorized internal user opens a merchant detail page with COD funds in held state
- **THEN** the `COD in Held` stat card exposes a settle action for that merchant

#### Scenario: Unauthorized user does not see settlement controls
- **WHEN** a user without merchant settlement permissions opens a merchant detail page
- **THEN** the system does not render settlement mode controls or settlement history actions for that user

#### Scenario: Merchant detail opens settlement history
- **WHEN** an authorized internal user opens the settlement history tab or view on merchant detail
- **THEN** the system returns settlement history scoped to the current merchant only

### Requirement: Merchant detail settlement mode preserves merchant scope
The system SHALL keep settlement mode scoped to the merchant detail record that launched it. Settlement mode MUST NOT allow selecting parcels from another merchant, and settlement history MUST NOT include settlements for another merchant.

#### Scenario: Settlement mode lists only current merchant parcels
- **WHEN** an authorized user enters settlement mode from a merchant detail page
- **THEN** every available parcel row belongs to that merchant

#### Scenario: Cross-merchant settlement selection is rejected
- **WHEN** a settlement generation request includes a parcel that belongs to another merchant
- **THEN** the system rejects the request and does not create a settlement

