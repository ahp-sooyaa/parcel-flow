## ADDED Requirements

### Requirement: Admin dashboard shows riders with pending cash handovers

The system SHALL add a `Rider Cash Handover` tab to the admin settlement workspace and list riders who have delivered parcels that still need office cash receipt confirmation.

#### Scenario: Eligible riders are listed in the dashboard tab

- **WHEN** an admin or superadmin opens the dashboard and at least one rider has delivered parcels with `is_received_by_office = false`
- **THEN** the system shows a `Rider Cash Handover` tab in the same workspace as merchant settlements
- **AND** the tab lists one row per rider with pending handover work
- **AND** the row totals include delivered parcel count, collected delivery fee total, collected COD total, and total handover cash

#### Scenario: Non-COD delivered parcels are included in rider eligibility

- **WHEN** a rider has delivered non-COD parcels with collected delivery fees and `is_received_by_office = false`
- **THEN** the system includes those parcels in the rider's pending handover totals
- **AND** the rider remains visible in the `Rider Cash Handover` tab even if none of the pending parcels are COD

#### Scenario: Empty rider handover state is shown

- **WHEN** an admin or superadmin opens the `Rider Cash Handover` tab and no delivered parcels remain pending office receipt
- **THEN** the system shows an empty state for rider cash handover work

### Requirement: Admin can review one rider's pending delivered parcels in a sheet

The system SHALL allow an authorized admin user to open a right-side sheet for one rider and review the delivered parcels that are still awaiting office cash handover confirmation.

#### Scenario: Confirm Handover opens rider parcel sheet

- **WHEN** an admin or superadmin clicks `Confirm Handover` for a rider in the `Rider Cash Handover` tab
- **THEN** the system opens a right-side sheet
- **AND** the sheet lists that rider's delivered parcels with `is_received_by_office = false`
- **AND** each listed parcel shows enough detail to identify the parcel and its collected cash components

#### Scenario: Sheet supports select all and partial selection

- **WHEN** an admin or superadmin views a rider handover sheet with one or more eligible parcels
- **THEN** the system preselects all visible eligible parcels by default
- **AND** the system allows selecting or deselecting individual parcels
- **AND** the system allows selecting or clearing all visible parcels in one action

#### Scenario: Sheet blocks submission without any selected parcels

- **WHEN** an admin or superadmin clears all selected parcels in the rider handover sheet and submits
- **THEN** the system rejects the request
- **AND** the system keeps the sheet open with a validation error

### Requirement: Admin can confirm office receipt for selected rider parcels

The system SHALL allow an authorized admin user to confirm office cash receipt for one rider across multiple delivered parcels in a single atomic action.

#### Scenario: Selected parcels are marked received by office

- **WHEN** an admin or superadmin submits handover confirmation for one or more eligible delivered parcels of the same rider
- **THEN** the system sets `parcels.is_received_by_office` to `true` for each selected parcel
- **AND** the system sets `parcels.collection_confirmed_by` to the acting user for each selected parcel
- **AND** the system creates one pending `financial_items` row with `item_type = cod_remit` for each selected COD parcel
- **AND** the system persists the updates atomically
- **AND** the confirmed parcels no longer appear as pending rider handover work

#### Scenario: Non-COD handover confirmation does not create COD remit item

- **WHEN** an admin or superadmin confirms rider cash handover for a delivered non-COD parcel
- **THEN** the system does not create a `cod_remit` financial item for that parcel
- **AND** the system still marks the parcel as received by office

#### Scenario: Stale or mixed-rider selections are rejected

- **WHEN** an admin or superadmin submits a handover confirmation containing a parcel that is missing, belongs to a different rider, is not `delivered`, or already has `is_received_by_office = true`
- **THEN** the system rejects the confirmation
- **AND** the system does not partially confirm any selected parcel

#### Scenario: Unauthorized handover confirmation is rejected

- **WHEN** a non-admin user attempts to confirm rider cash handover
- **THEN** the system rejects the request without changing any parcel handover state
