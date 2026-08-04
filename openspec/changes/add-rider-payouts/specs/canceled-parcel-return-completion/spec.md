## MODIFIED Requirements

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
