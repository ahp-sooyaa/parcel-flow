## MODIFIED Requirements

### Requirement: Rider can complete assigned canceled-return parcels

The system SHALL allow an active rider to complete merchant return work for a parcel assigned to their rider profile when the parcel status is `canceled_returned`. The web rider page and the mobile API SHALL apply the same rules through one shared operation.

#### Scenario: Rider sees return completion action for assigned canceled-return parcel

- **WHEN** a rider opens an assigned parcel in the rider `To Deliver` workflow and the parcel status is `canceled_returned`
- **THEN** the system shows a rider completion action for merchant return work

#### Scenario: Unauthorized return completion is rejected

- **WHEN** a non-rider user, inactive rider, unrelated rider, or rider for a parcel not in `canceled_returned` status submits a return-completion request
- **THEN** the system rejects the request without changing parcel data or creating financial items

#### Scenario: Web and mobile share return completion rules

- **WHEN** a rider completes a return from the web rider page or the mobile app
- **THEN** the same validation, ownership and status rules apply, with the same messages, and the same parcel state and financial items are written
