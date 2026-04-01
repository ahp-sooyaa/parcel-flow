## ADDED Requirements

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
The system SHALL provide an internal merchant creation workflow that only authorized staff can use, with server-side validation and explicit field allowlisting.

#### Scenario: Staff creates merchant with required fields
- **WHEN** an authorized staff user submits valid merchant create data with name, address, and township
- **THEN** the system creates a merchant record and stores only allowed fields

#### Scenario: Phone and notes are optional on create
- **WHEN** an authorized staff user submits valid merchant create data without phone and without notes
- **THEN** the system creates the merchant record successfully

#### Scenario: Unauthorized user cannot create merchant
- **WHEN** an authenticated user without merchant create permission submits merchant create data
- **THEN** the system denies creation

### Requirement: Merchant create input is validated and explicit
The system MUST validate merchant create input on the server and MUST reject invalid or unexpected payload fields.

#### Scenario: Invalid required field is rejected
- **WHEN** merchant create payload omits a required field such as merchant name
- **THEN** the system rejects the request with validation error details

#### Scenario: Unexpected field is not written
- **WHEN** merchant create payload includes a field outside the allowed create contract
- **THEN** the system ignores or rejects the unexpected field and does not persist it

### Requirement: Merchant records support future account and financial workflows
The system SHALL store merchant profile data in a way that supports later parcel linkage, payment/settlement views, and optional merchant login via admin-created user accounts.

#### Scenario: Merchant can exist without linked app user
- **WHEN** authorized staff creates a merchant without linked app user account
- **THEN** the system stores a valid merchant record with no required user linkage

#### Scenario: Merchant can be linked to an app user account
- **WHEN** authorized staff supplies a valid app user identifier during merchant create or update flow
- **THEN** the system stores the merchant-to-user linkage for future merchant login and self-scope authorization

### Requirement: Merchant detail access supports self-scope for merchant role
The system SHALL define merchant-role detail access as self-scope only and SHALL enforce this rule on the server when detail filtering is implemented.

#### Scenario: Merchant-role requests own merchant detail
- **WHEN** an authenticated merchant-role user requests detail for the merchant profile linked to their account
- **THEN** the system allows access

#### Scenario: Merchant-role requests other merchant detail
- **WHEN** an authenticated merchant-role user requests detail for a different merchant profile
- **THEN** the system denies access
