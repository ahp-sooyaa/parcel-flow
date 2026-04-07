## MODIFIED Requirements

### Requirement: Admin parcel create access control
The system SHALL allow `superadmin` and `admin` users to create parcels from the dashboard for any permitted merchant. The system SHALL also allow authenticated merchant users to create parcels through the shared parcel create workflow only for the merchant profile linked to their own account. The server MUST reject any create attempt from other roles or any merchant-scoped create request that targets a different merchant.

#### Scenario: Admin creates parcel successfully
- **WHEN** an authenticated `superadmin` or `admin` submits a valid parcel create request
- **THEN** the system creates the parcel and returns a success response

#### Scenario: Merchant user creates parcel for owned merchant
- **WHEN** an authenticated merchant user submits a valid parcel create request for the merchant profile linked to their account
- **THEN** the system creates the parcel and returns a success response

#### Scenario: Merchant create shows merchant as read-only and server-owned
- **WHEN** an authenticated merchant user opens the shared parcel create page
- **THEN** the merchant field is rendered read-only for clarity and the server persists the parcel only for the merchant linked to the current session

#### Scenario: Merchant user attempts create for another merchant
- **WHEN** an authenticated merchant user submits a parcel create request using a different merchant identifier than their linked merchant record
- **THEN** the system rejects the request with an authorization error and no data is written

#### Scenario: Unauthorized non-merchant non-admin user cannot create parcel
- **WHEN** an authenticated user who is neither admin nor merchant owner submits a parcel create request
- **THEN** the system rejects the request with an authorization error and no data is written

### Requirement: Admin parcel update access control
The system SHALL allow `superadmin` and `admin` users to update parcel details from the dashboard. The system SHALL also allow authenticated merchant users to update parcels through the shared parcel edit workflow only when the parcel belongs to the merchant profile linked to their own account. Rider users and other non-admin roles MUST NOT receive parcel edit access.

#### Scenario: Admin updates parcel successfully
- **WHEN** an authenticated `superadmin` or `admin` submits a valid parcel update request
- **THEN** the system updates the parcel and returns a success response

#### Scenario: Merchant user updates owned parcel
- **WHEN** an authenticated merchant user submits a valid parcel update request for a parcel linked to their own merchant record
- **THEN** the system updates the parcel and returns a success response

#### Scenario: Merchant user attempts to update another merchant parcel
- **WHEN** an authenticated merchant user submits a parcel update request for a parcel linked to a different merchant
- **THEN** the system rejects the request with an authorization error and no data is changed

#### Scenario: Rider user cannot access parcel edit
- **WHEN** an authenticated rider user submits or opens a parcel edit request
- **THEN** the system denies access and preserves the current parcel state
