# merchant-settlement-management Specification

## Purpose

TBD - created by archiving change manage-merchant-settlements. Update Purpose after archive.

## Requirements

### Requirement: Admin dashboard shows merchants eligible for settlement

The system SHALL replace the current admin dashboard parcel table with a merchant settlement workspace that lists merchants who have eligible settlement financial items.

#### Scenario: Eligible merchants are listed on the dashboard

- **WHEN** an admin or superadmin opens the dashboard and at least one merchant has eligible settlement financial items
- **THEN** the system shows a merchant list instead of the current parcel table
- **AND** each listed merchant represents pending eligible settlement work

#### Scenario: Dashboard handles no eligible merchants

- **WHEN** an admin or superadmin opens the dashboard and no merchants have eligible settlement financial items
- **THEN** the system shows an empty state for merchant settlement eligibility

### Requirement: Admin can draft a settlement from eligible financial items

The system SHALL allow an authorized admin user to open an eligible merchant in a right-side sheet, select one or more eligible financial items, and generate a merchant settlement.

#### Scenario: Merchant settlement sheet shows eligible items

- **WHEN** an admin or superadmin opens a merchant from the dashboard settlement workspace
- **THEN** the system opens a right-side sheet
- **AND** the sheet lists eligible `financial_items` for that merchant
- **AND** the sheet allows selecting multiple items for one settlement

#### Scenario: Settlement is created from selected items

- **WHEN** an authorized admin or superadmin submits a merchant settlement with one or more eligible financial items selected
- **AND** the selected COD remit total is greater than or equal to the selected delivery fee deduction total
- **THEN** the system creates one `merchant_settlements` record for that merchant
- **AND** the settlement status is `pending`
- **AND** the system links each selected `financial_items` row to the created settlement
- **AND** the system marks each selected `financial_items` row as reserved for that settlement so the items cannot be selected into another settlement

#### Scenario: Ineligible or stale financial item selection is rejected

- **WHEN** an authorized admin or superadmin submits a settlement containing a financial item that is missing, belongs to another merchant, is already attached to another settlement, or is no longer eligible
- **THEN** the system rejects the settlement creation
- **AND** the system does not create a partial settlement or partial item reservation

#### Scenario: Negative settlement selection is rejected

- **WHEN** an authorized admin or superadmin submits a settlement whose selected delivery fee deduction total is greater than the selected COD remit total
- **THEN** the system rejects the settlement creation
- **AND** the system does not create a settlement record
- **AND** the system does not reserve any selected financial items

### Requirement: Settlements listing is resolution-focused

The system SHALL remove settlement draft creation from the merchant settlements listing page and use that page to show created settlement records and their current status.

#### Scenario: Create settlement entry point is removed from listing page

- **WHEN** an admin or superadmin opens the merchant settlements listing page
- **THEN** the system does not show the current `Create Settlement` button or sheet trigger

#### Scenario: Newly created pending settlement appears in listing

- **WHEN** a merchant settlement is successfully generated from the dashboard
- **THEN** the system shows that settlement in the merchant settlements listing page
- **AND** the settlement status appears as `pending`

### Requirement: Superadmin resolves pending settlements with transfer receipt proof

The system SHALL allow only superadmins to resolve a pending merchant settlement by uploading a bank transfer receipt and marking the settlement as paid.

#### Scenario: Superadmin can resolve pending settlement

- **WHEN** a superadmin uploads a bank transfer receipt for a settlement whose current status is `pending`
- **THEN** the system stores the receipt proof on the settlement
- **AND** the system marks the settlement status as `settled`
- **AND** the system marks the linked settlement financial items as `settled`

#### Scenario: Non-superadmin cannot resolve pending settlement

- **WHEN** an admin or any non-superadmin user attempts to resolve a pending settlement
- **THEN** the system rejects the request without changing the settlement or linked financial items

#### Scenario: Resolution is atomic

- **WHEN** any required receipt upload or settlement persistence step fails during pending-settlement resolution
- **THEN** the system does not persist a partially settled settlement
- **AND** the system does not persist partially updated linked financial items
