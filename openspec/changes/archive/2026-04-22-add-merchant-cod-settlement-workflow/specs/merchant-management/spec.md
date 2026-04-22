## ADDED Requirements

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
