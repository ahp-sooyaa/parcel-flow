## ADDED Requirements

### Requirement: Merchant financial items are derived from parcel and payment truth
The system SHALL persist merchant financial items as settlement candidates derived from `parcels` and `parcel_payment_records`. Each merchant financial item SHALL belong to exactly one merchant, identify its source parcel context, declare its candidate kind, declare whether the company owes the merchant or the merchant owes the company, and store the current monetary amount for settlement selection.

#### Scenario: Delivered COD parcel creates remit credit candidate
- **WHEN** a merchant parcel is `delivered`, is `cod`, has COD status `collected`, has collection status `received_by_office`, has no active merchant settlement lock, and its delivery-fee state is already valid for settlement
- **THEN** the system persists or refreshes an open merchant financial item representing a COD remittance credit for that parcel

#### Scenario: Merchant-billed delivery fee creates debit candidate
- **WHEN** a parcel reaches a resolved financial outcome where the merchant owes the company through `bill_merchant`
- **THEN** the system persists or refreshes an open merchant financial item representing a merchant debit for that parcel's delivery fee obligation

#### Scenario: Cancelled prepaid parcel creates refund credit candidate
- **WHEN** a parcel becomes refund-eligible after cancellation and the merchant's prepaid delivery fee receipt was previously verified by office or admin workflow
- **THEN** the system persists or refreshes an open merchant financial item representing a refund credit for that parcel

### Requirement: Merchant financial items expose readiness and uniqueness for settlement
The system SHALL prevent duplicate open merchant financial items for the same source obligation and SHALL expose whether each item is ready, blocked, locked, closed, or void so the settlement workspace can render it safely.

#### Scenario: Candidate recalculation updates existing open item
- **WHEN** the system reevaluates a parcel or payment record that already has an open merchant financial item for the same obligation
- **THEN** the system updates the existing open merchant financial item instead of creating a duplicate candidate

#### Scenario: Blocked item keeps reason metadata
- **WHEN** a merchant financial item's source parcel or payment state is not yet valid for settlement generation
- **THEN** the system keeps the item out of the selectable ready set and stores blocked reason data for workspace display

#### Scenario: Locked item cannot be selected by another active document
- **WHEN** an open merchant financial item is included in a generated merchant settlement document
- **THEN** the system marks that item as locked and excludes it from other ready-to-settle selections until the document is paid, cancelled, or rejected

### Requirement: Refund credits require verified payment before candidate creation
The system SHALL NOT create a refund credit candidate for a cancelled parcel unless the merchant's prepaid delivery fee was actually verified as received by the company and the parcel remains refundable under the documented refund policy.

#### Scenario: Unverified prepaid evidence does not create refund candidate
- **WHEN** a cancelled parcel has only merchant-uploaded receipt evidence and office or admin workflow has not verified that the money was received
- **THEN** the system does not create an open refund credit candidate for that parcel

#### Scenario: Verified prepaid fee can create refund candidate
- **WHEN** a cancelled parcel is refund-eligible and the related merchant prepaid fee was verified as received
- **THEN** the system creates or refreshes the refund credit candidate and makes it available for settlement selection
