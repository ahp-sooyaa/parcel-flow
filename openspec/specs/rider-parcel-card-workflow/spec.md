# rider-parcel-card-workflow Specification

## Purpose

TBD - created by archiving change rider-parcels-card-view. Update Purpose after archive.

## Requirements

### Requirement: Rider parcel page uses card list

The system SHALL render `/dashboard/rider/parcels` with a rider-specific parcel card list instead of the shared parcel table.

#### Scenario: Rider opens parcel page

- **WHEN** a rider opens `/dashboard/rider/parcels`
- **THEN** the system displays assigned parcels as cards rather than table rows

#### Scenario: Desktop card grid

- **WHEN** a rider views the parcel page on a desktop-width viewport
- **THEN** the system displays the parcel cards in three or four columns as available space allows

#### Scenario: Mobile card list

- **WHEN** a rider views the parcel page on a mobile-width viewport
- **THEN** the system displays parcel cards in one column

### Requirement: Rider parcel cards are collapsible

The system SHALL render rider parcel cards in a collapsed state by default and expand a card when the rider clicks the card body.

#### Scenario: Default collapsed card

- **WHEN** rider parcel cards first render
- **THEN** each card shows parcel code, recipient name, current status, and a multi-select checkbox only

#### Scenario: Expanded at-office card content

- **WHEN** a rider expands a parcel card
- **THEN** the card also shows recipient phone number, recipient address, amount to collect, available delivery action, and an underlined detail link

#### Scenario: Expanded on-the-way card actions

- **WHEN** a rider expands an assigned parcel card whose current status is `on_the_way`
- **THEN** the card shows `Report Failure` and `Mark Delivered` buttons without submitting status changes

#### Scenario: Card collapse toggle

- **WHEN** a rider clicks an expanded card body
- **THEN** the card collapses back to the compact state

### Requirement: Rider parcel filtering

The system SHALL provide rider-facing tab, search, township, and status filters for assigned parcels.

#### Scenario: To deliver tab

- **WHEN** a rider selects the `To Deliver` tab
- **THEN** the system shows assigned parcels whose current status is `at_office`, `on_the_way`, or `canceled_returned`

#### Scenario: Delivered tab

- **WHEN** a rider selects the `Delivered` tab
- **THEN** the system shows assigned parcels whose current status is `delivered`

#### Scenario: Search assigned parcels

- **WHEN** a rider enters a search term
- **THEN** the system filters the active tab by parcel code, recipient name, or recipient phone number

#### Scenario: Filter by township

- **WHEN** a rider selects a township filter
- **THEN** the system filters the active tab to assigned parcels in that township

#### Scenario: Filter by status

- **WHEN** a rider selects one or more status filters
- **THEN** the system filters the active tab to assigned parcels with the selected statuses

### Requirement: Rider card pagination

The system SHALL paginate the filtered rider parcel card list.

#### Scenario: More results than page size

- **WHEN** the filtered rider parcel list has more parcels than the configured page size
- **THEN** the system displays only the current page of cards and pagination controls

#### Scenario: Filter changes reset pagination

- **WHEN** the rider changes the active tab, search term, township filter, or status filter
- **THEN** the system returns the card list to the first page of matching results

#### Scenario: No matching parcels

- **WHEN** no assigned parcels match the active tab, search term, filters, and page state
- **THEN** the system displays an empty state instead of an empty card grid

### Requirement: Rider parcel selection

The system SHALL allow riders to select one or more eligible assigned parcel cards for start-delivery action.

#### Scenario: Select eligible parcel

- **WHEN** an assigned parcel has current status `at_office`
- **THEN** the card checkbox is enabled for rider selection

#### Scenario: Disable ineligible parcel selection

- **WHEN** an assigned parcel has current status other than `at_office`
- **THEN** the card checkbox is disabled for start-delivery selection

#### Scenario: Return work remains visible

- **WHEN** an assigned parcel has current status `canceled_returned`
- **THEN** the system shows it in the `To Deliver` tab without making it eligible for start-delivery selection

#### Scenario: Preserve valid selection after filtering

- **WHEN** filters or pagination change the visible card list
- **THEN** the system keeps selected eligible parcel IDs valid and removes selected IDs that are no longer eligible

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

### Requirement: Future status action affordances

The system SHALL show future status action buttons for assigned `on_the_way` parcels without wiring their mutations in this change.

#### Scenario: Show report failure button

- **WHEN** a rider expands an assigned parcel card whose current status is `on_the_way`
- **THEN** the system displays a `Report Failure` button that does not write data in this change

#### Scenario: Show mark delivered button

- **WHEN** a rider expands an assigned parcel card whose current status is `on_the_way`
- **THEN** the system displays a `Mark Delivered` button that does not write data in this change

### Requirement: Rider parcel detail sheet

The system SHALL open parcel details from a lightweight card detail link in a full-width and full-height right-side sheet.

#### Scenario: Open detail sheet

- **WHEN** a rider clicks the underlined detail link on an expanded card
- **THEN** the system opens a shadcn right-side sheet with parcel details

#### Scenario: Detail link is not primary action

- **WHEN** a rider views an expanded parcel card
- **THEN** the detail control appears as a lightweight underlined text link rather than a large button
