## ADDED Requirements

### Requirement: Merchant settlement operations require explicit permissions
The system SHALL define explicit merchant settlement permissions and SHALL enforce them in route access, UI gating, and server actions. Settlement permissions MUST cover viewing settlement history, generating settlements, confirming payment, and cancelling or rejecting pending settlements.

#### Scenario: Authorized user views settlement history
- **WHEN** a user has merchant settlement view permission and requests merchant settlement history
- **THEN** the system allows the read and returns only authorized settlement DTO data

#### Scenario: Unauthorized user cannot generate settlement
- **WHEN** a user without merchant settlement create permission submits settlement generation data
- **THEN** the server action rejects the request and no settlement or settlement item records are created

#### Scenario: Unauthorized user cannot confirm payment
- **WHEN** a user without merchant settlement confirm permission submits payment confirmation data
- **THEN** the server action rejects the request and the settlement remains unpaid

#### Scenario: Unauthorized user cannot cancel or reject settlement
- **WHEN** a user without merchant settlement cancel permission submits a cancellation or rejection request
- **THEN** the server action rejects the request and preserves the settlement and payment record states

### Requirement: Settlement permissions fit existing first-iteration role model
The system SHALL add settlement permissions without introducing a new application role. Super admins SHALL receive all settlement permissions through the permission matrix, and any finance-like access for office users SHALL be represented by assigned permissions under the existing role model.

#### Scenario: Super admin receives settlement permissions
- **WHEN** auth foundation seed data is initialized
- **THEN** the super admin role includes merchant settlement view, create, confirm, and cancel permissions

#### Scenario: Finance access does not require new role
- **WHEN** an internal user is granted finance-like settlement authority in this iteration
- **THEN** the system represents that authority with merchant settlement permissions rather than a new role slug

#### Scenario: Merchant and rider roles lack settlement permissions
- **WHEN** auth foundation seed data is initialized
- **THEN** merchant and rider roles do not receive merchant settlement permissions
