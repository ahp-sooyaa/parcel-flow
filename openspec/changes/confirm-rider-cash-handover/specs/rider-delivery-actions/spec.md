## MODIFIED Requirements

### Requirement: Delivered parcel financial items are generated

The system SHALL generate pending financial items when rider parcel completion or later office confirmation makes a parcel financially eligible for downstream settlement or payout workflows.

#### Scenario: COD delivered parcel creates only rider payout item before office handover

- **WHEN** an active rider marks their assigned COD `on_the_way` parcel delivered with a valid proof photo
- **THEN** the system does not create a `cod_remit` financial item at delivery time
- **AND** the system creates one `financial_items` row with `item_type = rider_way_payout`, `amount = 1`, `status = pending`, `merchant_id = parcel.merchant_id`, `rider_id = parcel.rider_id`, and `parcel_id = parcel.id`

#### Scenario: COD handover confirmation creates settlement item

- **WHEN** an admin or superadmin confirms office receipt for a delivered COD parcel whose `is_received_by_office = false`
- **THEN** the system creates one `financial_items` row with `item_type = cod_remit`, `amount = parcel.cod_amount`, `status = pending`, `merchant_id = parcel.merchant_id`, and `parcel_id = parcel.id`

#### Scenario: Non-COD delivered parcel creates only payout item

- **WHEN** an active rider marks their assigned non-COD `on_the_way` parcel delivered with a valid proof photo
- **THEN** the system does not create a `cod_remit` financial item
- **AND** the system creates one `financial_items` row with `item_type = rider_way_payout`, `amount = 1`, `status = pending`, `merchant_id = parcel.merchant_id`, `rider_id = parcel.rider_id`, and `parcel_id = parcel.id`

#### Scenario: Delivery completion remains atomic

- **WHEN** any required parcel update or rider payout financial item creation fails during mark delivered
- **THEN** the system does not persist a partially delivered parcel state
- **AND** the system does not persist partial financial item rows

#### Scenario: Handover confirmation remains atomic

- **WHEN** any required parcel update or COD remit financial item creation fails during rider cash handover confirmation
- **THEN** the system does not persist a partially confirmed office handover state
- **AND** the system does not persist partial COD remit financial item rows
