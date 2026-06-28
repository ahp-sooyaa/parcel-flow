## MODIFIED Requirements

### Requirement: Postpone failed parcel

The system SHALL allow super admins and office admins to mark an unresolved failed parcel as `postpone` after reviewing the rider failure note while preserving the failed delivery attempt way credit.

#### Scenario: Admin postpones failed parcel

- **WHEN** a super admin or office admin clicks `Postpone` for an eligible parcel with status `on_the_way`, a non-empty `delivery_failure_note`, and an assigned rider
- **THEN** the system sets `status = postpone`, clears `rider_id`, clears `assigned_at`, writes a parcel status log, and closes or refreshes the dialog state

#### Scenario: Postpone removes rider expected collection

- **WHEN** a parcel is postponed after failure review
- **THEN** the previously assigned rider's expected collection no longer includes that parcel's COD amount or delivery fee

#### Scenario: Postpone preserves failed attempt way credit

- **WHEN** a parcel is postponed after failure review
- **THEN** the system does not create merchant settlement financial items, additional rider payout financial items, delivered timestamps, collected timestamps, or return timestamps
- **AND** the system does not void the existing pending `delivery_attempt` rider way payout item for the rider who attempted delivery

### Requirement: Mark failed parcel for merchant return

The system SHALL allow super admins and office admins to mark an unresolved failed parcel as `canceled_returned` after reviewing the rider failure note while preserving the failed delivery attempt way credit.

#### Scenario: Admin marks parcel for return handling

- **WHEN** a super admin or office admin clicks `Return Merchant` for an eligible parcel with status `on_the_way`, a non-empty `delivery_failure_note`, and an assigned rider
- **THEN** the system sets `status = canceled_returned`, clears `rider_id`, clears `assigned_at`, writes a parcel status log, and closes or refreshes the dialog state

#### Scenario: Return handling removes rider expected collection

- **WHEN** a parcel is marked `canceled_returned` after failure review
- **THEN** the previously assigned rider's expected collection no longer includes that parcel's COD amount or delivery fee

#### Scenario: Return handling preserves attempt way and defers return items

- **WHEN** a parcel is marked `canceled_returned` after failure review
- **THEN** the system does not create a delivery fee deduction financial item until the parcel later becomes `returned_to_merchant`
- **AND** the system does not create a merchant-return rider way payout item until a rider completes the return work
- **AND** the existing pending `delivery_attempt` rider way payout item remains linked to the rider who attempted delivery

