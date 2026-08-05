# canceled-parcel-return-completion Specification

## Purpose

TBD - created by archiving change rider-completes-canceled-return. Update Purpose after archive.

## Requirements

### Requirement: Rider can complete assigned canceled-return parcels

The system SHALL allow an active rider to complete merchant return work for a parcel assigned to their rider profile when the parcel status is `canceled_returned`.

#### Scenario: Rider sees return completion action for assigned canceled-return parcel

- **WHEN** a rider opens an assigned parcel in the rider `To Deliver` workflow and the parcel status is `canceled_returned`
- **THEN** the system shows a rider completion action for merchant return work

#### Scenario: Unauthorized return completion is rejected

- **WHEN** a non-rider user, inactive rider, unrelated rider, or rider for a parcel not in `canceled_returned` status submits a return-completion request
- **THEN** the system rejects the request without changing parcel data or creating financial items

### Requirement: Returned-to-merchant parcel state is persisted

The system SHALL persist successful rider return completion by updating the parcel status and return timestamp.

#### Scenario: Rider completes assigned canceled-return parcel

- **WHEN** an active rider completes an assigned parcel whose current status is `canceled_returned`
- **THEN** the system sets `parcels.status` to `returned_to_merchant`
- **AND** the system sets `parcels.returned_to_merchant_at`
- **AND** the system keeps the parcel linked to the rider who completed the return

#### Scenario: Completed return leaves rider to-deliver workflow

- **WHEN** a rider successfully completes return work for an assigned `canceled_returned` parcel
- **THEN** the parcel no longer appears in the rider `To Deliver` tab

#### Scenario: Completed return appears in rider returned workflow

- **WHEN** a rider views rider parcels after successfully completing return work for an assigned parcel
- **THEN** the parcel appears in a rider `Returned` tab while its status is `returned_to_merchant`

### Requirement: Returned parcel financial item is generated on completion

The system SHALL generate the merchant delivery-fee deduction financial item and the assigned return rider's way payout item only when return work is successfully completed.

#### Scenario: Successful return completion creates pending deduction and rider way items

- **WHEN** an active rider completes an assigned `canceled_returned` parcel
- **THEN** the system creates one `financial_items` row with `item_type = delivery_fee_deduction`, `amount = parcel.delivery_fee`, `status = pending`, `merchant_id = parcel.merchant_id`, and `parcel_id = parcel.id`
- **AND** the system creates one `financial_items` row with `item_type = rider_way_payout`, `amount = 1`, `status = pending`, `merchant_id = parcel.merchant_id`, `rider_id` set to the assigned return rider, `parcel_id = parcel.id`, and rider way source `merchant_return`

#### Scenario: Return completion by different rider preserves original delivery attempt credit

- **WHEN** Rider One has an existing `delivery_attempt` rider way payout item for a failed parcel and Rider Two later completes assigned return work for the same parcel
- **THEN** Rider One's existing rider way payout item remains linked to Rider One
- **AND** the system creates a separate `merchant_return` rider way payout item linked to Rider Two
- **AND** Rider One does not receive the merchant-return way count
- **AND** Rider Two does not receive the earlier delivery-attempt way count

#### Scenario: Return completion does not create COD remit items

- **WHEN** an active rider completes an assigned `canceled_returned` parcel
- **THEN** the system does not create a `cod_remit` financial item
- **AND** the system does not create a `delivery_attempt` rider way payout item

#### Scenario: Return completion is atomic

- **WHEN** any required parcel update or financial item creation fails during rider return completion
- **THEN** the system does not persist a partially returned parcel state
- **AND** the system does not persist partial financial item rows
