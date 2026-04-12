## MODIFIED Requirements

### Requirement: Admin-only user creation
The system SHALL allow user creation only by authorized admins and SHALL reject creation attempts from unauthorized roles. The admin user creation workflow SHALL support role-aware provisioning for `merchant` and `rider` accounts in the same server-side operation.

#### Scenario: Super admin creates an office admin user
- **WHEN** a `super_admin` submits valid office-admin user creation input
- **THEN** the system creates the Supabase identity and corresponding `app_users` record without creating merchant or rider profile rows

#### Scenario: Admin creates a merchant user with merchant profile fields
- **WHEN** an authorized admin submits valid user creation input with role `merchant`
- **THEN** the system creates the Supabase identity, the `app_users` record, and the required merchant profile record in one provisioning flow

#### Scenario: Admin creates a rider user with rider profile fields
- **WHEN** an authorized admin submits valid user creation input with role `rider`
- **THEN** the system creates the Supabase identity, the `app_users` record, and the required rider profile record in one provisioning flow

#### Scenario: Unauthorized role attempts user creation
- **WHEN** a role without user creation permission invokes user creation
- **THEN** the system rejects the request

### Requirement: Support inactive user creation
The system SHALL allow admins to create users as inactive and persist that status at creation time. If the created role requires a merchant or rider profile, the system SHALL still create that profile row while keeping the account inactive.

#### Scenario: Admin selects inactive during merchant user creation
- **WHEN** an authorized admin submits merchant-role user creation with inactive status
- **THEN** the system stores the user as inactive and creates the required merchant profile row

#### Scenario: Admin selects inactive during rider user creation
- **WHEN** an authorized admin submits rider-role user creation with inactive status
- **THEN** the system stores the user as inactive and creates the required rider profile row

## ADDED Requirements

### Requirement: Role-specific profile defaults are applied during provisioning
The system SHALL apply explicit server-side defaults when creating role-specific profile rows from the user create workflow and SHALL leave unspecified optional profile fields as `null` unless a documented default is required.

#### Scenario: Merchant shop name defaults from app user name
- **WHEN** an authorized admin creates a merchant-role user without providing `shop_name`
- **THEN** the system stores the merchant profile with `shop_name` equal to the created app user's full name

#### Scenario: Rider vehicle type defaults to bike
- **WHEN** an authorized admin creates a rider-role user without providing `vehicle_type`
- **THEN** the system stores the rider profile with `vehicle_type` set to `bike`

#### Scenario: Optional role-specific fields remain null when omitted
- **WHEN** an authorized admin omits optional merchant or rider profile fields other than documented defaults
- **THEN** the system stores those omitted fields as `null`

### Requirement: Provisioning fails closed when profile creation cannot complete
The system MUST avoid leaving a partially provisioned merchant-role or rider-role account when any required profile write fails after identity creation has started.

#### Scenario: Merchant profile write fails after auth user creation
- **WHEN** the system has created the Supabase auth user but merchant profile creation fails
- **THEN** the system aborts provisioning, removes any newly created auth identity or app-user record created by that request, and returns an error

#### Scenario: Rider profile write fails after app user insert
- **WHEN** the system has created the auth user and app-user row but rider profile creation fails
- **THEN** the system aborts provisioning, cleans up the partial account state created by that request, and returns an error
