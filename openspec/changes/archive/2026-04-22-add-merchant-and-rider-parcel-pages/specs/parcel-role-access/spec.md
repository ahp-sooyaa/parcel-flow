## ADDED Requirements

### Requirement: Merchant parcel list is embedded in merchant self-detail
The system SHALL show parcel list data for merchant users inside their self-detail page at `/dashboard/merchants/[id]`. Parcel rows returned for that view MUST be filtered on the server to the current merchant's linked record only and MUST NOT require `parcel-list.view` when access is already granted through `merchant.view`.

#### Scenario: Merchant self-detail shows only owned parcels
- **WHEN** an authenticated merchant user opens their own merchant detail page
- **THEN** the system displays a parcel list containing only parcels related to that merchant

#### Scenario: Merchant parcel list remains hidden outside self-scope
- **WHEN** a merchant-scoped request resolves to a merchant record not linked to the current session
- **THEN** the system returns no parcel list data for that request

### Requirement: Merchant users reuse shared parcel detail, create, and edit pages within self-scope
The system SHALL reuse the existing parcel detail, create, and edit route patterns for merchant users while enforcing merchant ownership checks on every server read and mutation. Merchant users MUST be able to open parcel detail, create a parcel, and edit an existing parcel only when the parcel belongs to their linked merchant record.

#### Scenario: Merchant user opens owned parcel detail
- **WHEN** an authenticated merchant user requests parcel detail for a parcel linked to their own merchant record
- **THEN** the system renders the shared parcel detail page with data scoped to that parcel

#### Scenario: Merchant user opens owned parcel edit
- **WHEN** an authenticated merchant user requests parcel edit for a parcel linked to their own merchant record
- **THEN** the system renders the shared parcel edit page and allows valid updates

#### Scenario: Merchant user cannot open another merchant parcel
- **WHEN** an authenticated merchant user requests parcel detail or parcel edit for a parcel linked to another merchant
- **THEN** the system denies access and returns no parcel data

### Requirement: Rider users can open rider-focused parcel detail only for assigned parcels
The system SHALL allow rider users to open parcel detail only for parcels assigned to their linked rider record. The rider parcel detail UI SHALL present a simplified operational view that includes parcel type, COD or non-COD context, and collectable amount, without exposing parcel create or parcel edit controls.

#### Scenario: Rider opens assigned parcel detail
- **WHEN** an authenticated rider user requests parcel detail for a parcel assigned to their linked rider record
- **THEN** the system renders the rider-specific parcel detail UI with the required operational fields

#### Scenario: Rider cannot open unassigned parcel detail
- **WHEN** an authenticated rider user requests parcel detail for a parcel not assigned to their linked rider record
- **THEN** the system denies access and returns no parcel data

#### Scenario: Rider detail omits create and edit controls
- **WHEN** an authenticated rider user views an assigned parcel detail page
- **THEN** the UI does not expose parcel create or parcel edit entry points

### Requirement: Rider parcel detail exposes only the allowed next action for the current status
The system SHALL derive rider action controls from the current parcel status and rider assignment. The rider UI MUST show only the next allowed rider workflow action for the parcel's current state, such as a pickup-oriented action for `pending`, and the server MUST validate both assignment scope and allowed status transition before applying the change.

#### Scenario: Rider sees next pickup action for pending assigned parcel
- **WHEN** an authenticated rider user opens parcel detail for an assigned parcel with status `pending`
- **THEN** the system shows a pickup-oriented next action instead of a deliver action

#### Scenario: Rider advances assigned parcel with allowed transition
- **WHEN** an authenticated rider user triggers the currently allowed next action for an assigned parcel
- **THEN** the system persists the corresponding next parcel status and returns a success response

#### Scenario: Rider cannot trigger action for unassigned parcel
- **WHEN** an authenticated rider user triggers a rider workflow action for a parcel not assigned to their linked rider record
- **THEN** the system rejects the request and preserves the existing parcel state

#### Scenario: Rider cannot trigger disallowed transition for current status
- **WHEN** an authenticated rider user attempts a rider workflow action that does not match the parcel's current allowed next step
- **THEN** the system rejects the request and preserves the existing parcel state
