## MODIFIED Requirements

### Requirement: Rider can start delivery

The system SHALL allow a rider to move one or more of their assigned parcels from `at_office` to `on_the_way` and create one delivery-attempt rider way credit for each parcel. The web rider page and the mobile API SHALL apply the same validation, permission and eligibility rules through one shared operation, and a single request SHALL start at most 50 parcels.

#### Scenario: Start delivery from expanded card

- **WHEN** a rider clicks `Start Delivery` on an expanded card for one of their assigned `at_office` parcels
- **THEN** the system changes that parcel status to `on_the_way`
- **AND** the system creates one `financial_items` row with `item_type = rider_way_payout`, `amount = 1`, `status = pending`, `rider_id` set to the assigned rider, `parcel_id` set to the parcel, and rider way source `delivery_attempt`

#### Scenario: Start delivery for selected parcels

- **WHEN** a rider selects multiple assigned `at_office` parcels and confirms the batch start-delivery action
- **THEN** the system changes all selected parcel statuses to `on_the_way`
- **AND** the system creates one pending `delivery_attempt` rider way payout financial item for each selected parcel

#### Scenario: Retry start delivery creates another way

- **WHEN** a previously failed parcel is postponed, reassigned, reset to `at_office`, and then an assigned rider starts delivery again
- **THEN** the system creates a new pending `delivery_attempt` rider way payout financial item for the retry
- **AND** any prior rider way payout item for the earlier failed attempt remains linked to the rider who made that earlier attempt

#### Scenario: Reject non-rider start delivery

- **WHEN** a non-rider user attempts the rider start-delivery action
- **THEN** the system rejects the mutation before writing data
- **AND** the system does not create rider payout financial items

#### Scenario: Reject unassigned or unrelated parcel

- **WHEN** a rider attempts to start delivery for a parcel that is not assigned to their rider account
- **THEN** the system rejects the mutation before writing data
- **AND** the system does not create rider payout financial items

#### Scenario: Reject ineligible status

- **WHEN** a rider attempts to start delivery for a parcel whose status is not `at_office`
- **THEN** the system rejects the mutation before writing data
- **AND** the system does not create rider payout financial items

#### Scenario: Start delivery is atomic

- **WHEN** any parcel status update or rider way item creation fails during start delivery
- **THEN** the system does not persist partial parcel status changes or partial rider way financial items

#### Scenario: Reject oversized batch

- **WHEN** a start-delivery request lists more than 50 parcels
- **THEN** the system rejects it with "Select up to 50 parcels at a time." before writing data

#### Scenario: Web result unchanged

- **WHEN** the web rider page starts delivery through the shared operation
- **THEN** the server action returns the same `{ ok, message }` shape and messages as before, and the web rider, admin and merchant parcel views show the new status on their next render
