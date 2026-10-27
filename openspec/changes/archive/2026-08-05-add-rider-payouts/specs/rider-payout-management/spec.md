## ADDED Requirements

### Requirement: Admin can view riders with eligible payout ways

The system SHALL show riders who have eligible pending rider way payout financial items.

#### Scenario: Eligible riders are listed

- **WHEN** a super admin or office admin opens the rider payout creation flow and at least one rider has eligible way items
- **THEN** the system lists one row per rider with pending eligible `financial_items`
- **AND** each rider row shows way count and enough summary data for payout review

#### Scenario: Eligibility comes from financial items

- **WHEN** the system evaluates rider payout eligibility
- **THEN** it includes only `financial_items` rows with `item_type = rider_way_payout`, `status = pending`, a matching non-null `rider_id`, and no `rider_payout_id`
- **AND** it does not rely on the parcel-level `rider_payout_status` field as the source of truth

#### Scenario: Empty eligible rider state

- **WHEN** no rider has eligible pending rider way payout items
- **THEN** the system shows an empty state instead of a selectable rider list

### Requirement: Admin can create rider payout draft

The system SHALL allow an authorized admin to create an in-progress rider payout from selected eligible rider way financial items.

#### Scenario: Payout sheet shows eligible rider way items

- **WHEN** a super admin or office admin selects a rider from the payout creation flow
- **THEN** the system opens or updates a shadcn right-side sheet with that rider's eligible pending rider way items
- **AND** each item shows the parcel identity, way source, item creation date, and payout status
- **AND** the sheet allows selecting one or more eligible items

#### Scenario: Payout draft is created from selected items

- **WHEN** an authorized admin submits a rider payout draft with a rider, one or more selected eligible financial items, and a positive fee per way
- **THEN** the system creates one `rider_payouts` record with `status = in_progress`
- **AND** `delivered_way_count` equals the selected rider way item count
- **AND** `total_payout_amount` equals selected rider way item count multiplied by `fee_per_way`
- **AND** the selected `financial_items` rows are linked to the payout with `rider_payout_id`
- **AND** the selected `financial_items` rows are marked `in_progress`
- **AND** affected parcel payout status summaries are recomputed from their active rider way items

#### Scenario: Stale or ineligible item selection is rejected

- **WHEN** an authorized admin submits a payout draft containing a financial item that is missing, belongs to another rider, is already linked to a payout, is not pending, or is not a rider way payout item
- **THEN** the system rejects the payout creation
- **AND** it does not create a partial payout or reserve partial financial items

#### Scenario: Unauthorized payout creation is rejected

- **WHEN** a merchant, rider, or unauthenticated user submits a rider payout draft request
- **THEN** the system rejects the request without creating payout records or changing financial items

### Requirement: Rider payout listing is persisted

The system SHALL list persisted rider payout records instead of hard-coded payout data.

#### Scenario: Persisted payouts are shown

- **WHEN** a super admin or office admin opens `/dashboard/rider-payouts`
- **THEN** the system shows rider payout records from the database
- **AND** each row includes payout code, rider, status, way count, fee per way, total payout amount, and created date

#### Scenario: Newly created draft appears in listing

- **WHEN** a rider payout draft is successfully created
- **THEN** the payout appears in the rider payout listing with `in_progress` status

### Requirement: Super admin can settle rider payout

The system SHALL allow only super admins to mark an in-progress rider payout as paid.

#### Scenario: Super admin settles payout

- **WHEN** a super admin marks an in-progress rider payout as paid
- **THEN** the system sets `rider_payouts.status = settled`
- **AND** the system sets `paid_by` and `paid_at` on the payout
- **AND** the system stores any submitted payment note
- **AND** the linked rider way `financial_items` rows are marked `settled`
- **AND** the linked rider way `financial_items.settled_at` is set
- **AND** affected parcel payout status summaries are recomputed from their active rider way items

#### Scenario: Non-super-admin settlement is rejected

- **WHEN** an office admin, merchant, rider, or unauthenticated user attempts to settle a rider payout
- **THEN** the system rejects the request without changing payout or financial item data

#### Scenario: Ineligible payout settlement is rejected

- **WHEN** a settlement request targets a missing payout, a payout not in `in_progress` status, or a payout whose linked financial items no longer match the in-progress payout state
- **THEN** the system rejects the settlement
- **AND** it does not partially settle the payout or linked financial items

### Requirement: Admin can cancel rider payout draft

The system SHALL allow authorized admins to cancel an in-progress rider payout draft before it is settled.

#### Scenario: In-progress payout draft is canceled

- **WHEN** a super admin or office admin cancels an in-progress rider payout
- **THEN** the system sets `rider_payouts.status = void`
- **AND** linked rider way `financial_items` rows are returned to `pending`
- **AND** linked rider way `financial_items.rider_payout_id` is cleared
- **AND** affected parcel payout status summaries are recomputed from their active rider way items

#### Scenario: Settled payout cannot be canceled

- **WHEN** a user attempts to cancel a settled rider payout
- **THEN** the system rejects the request without changing payout or financial item data
