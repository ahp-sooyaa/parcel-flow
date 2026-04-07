## MODIFIED Requirements

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
The system SHALL define merchant-role detail access as self-scope only and SHALL enforce this rule on the server using the required merchant-profile-to-app-user ownership relationship.

#### Scenario: Merchant-role requests own merchant detail
- **WHEN** an authenticated merchant-role user requests detail for the merchant profile owned by their app user record
- **THEN** the system allows access

#### Scenario: Merchant-role requests other merchant detail
- **WHEN** an authenticated merchant-role user requests detail for a different merchant profile
- **THEN** the system denies access

## ADDED Requirements

### Requirement: Merchant list and detail reflect business-only merchant fields
The system SHALL shape merchant list and detail responses so merchant-table fields contain business profile data only, while shared user identity data is joined from the related app user.

#### Scenario: Merchant list shows shop name from merchant profile
- **WHEN** an authorized internal user browses merchants
- **THEN** the list uses merchant business fields such as `shop_name` from the merchant profile row

#### Scenario: Merchant detail includes linked app user context
- **WHEN** an authorized internal user opens merchant detail
- **THEN** the detail response includes the owning app user's shared identity fields alongside merchant-specific profile fields
