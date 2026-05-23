## ADDED Requirements

### Requirement: Merchant overview page shows parcel and remittance summary cards
The system SHALL provide a merchant-only overview page at `dashboard/merchant/overview` that shows summary cards scoped to the current merchant account.

#### Scenario: Merchant overview displays requested summary metrics
- **WHEN** a merchant opens `dashboard/merchant/overview`
- **THEN** the system shows summary cards for `Total COD collected`, `Paid to you`, `Total Parcels`, `On the way parcels`, and `Delivered Parcels`
- **AND** `Total COD collected` includes only COD amounts from the merchant's delivered parcels and excludes delivery fees
- **AND** `Paid to you` equals the sum of `net_payment_amount` from the merchant's settlements whose status is `settled`

#### Scenario: Merchant overview handles zero values
- **WHEN** a merchant opens `dashboard/merchant/overview` and has no delivered parcels or no settled settlements
- **THEN** the system still renders the summary cards
- **AND** each metric with no data is shown as zero rather than omitted

### Requirement: Merchant overview shows settled settlement history
The system SHALL show a merchant-scoped settlement table below the overview cards that lists only settlements whose status is `settled`.

#### Scenario: Settled settlements are listed below the overview cards
- **WHEN** a merchant has one or more settled settlements
- **THEN** the system shows a settlement table below the summary cards
- **AND** every visible row belongs to the current merchant account
- **AND** every visible row has settlement status `settled`

#### Scenario: Pending and void settlements are excluded from merchant overview history
- **WHEN** a merchant has settlements with statuses other than `settled`
- **THEN** the system does not show those non-settled settlements in the overview settlement table

### Requirement: Merchant can search and filter settled settlement history
The system SHALL let the merchant filter overview settlement history by settlement code and created date.

#### Scenario: Merchant searches settled settlements by settlement code
- **WHEN** a merchant enters a settlement code search term on the overview page
- **THEN** the system filters the settlement table to rows whose settlement code matches the search term

#### Scenario: Merchant filters settled settlements by date
- **WHEN** a merchant selects a date from the overview page date picker filter
- **THEN** the system filters the settlement table to settled settlements whose created date matches the selected date

#### Scenario: Empty state reflects settlement search or date filters
- **WHEN** the merchant applies settlement filters that match no settled settlements
- **THEN** the system shows an empty state in the settlement table area
- **AND** the overview summary cards remain visible

### Requirement: Merchant settlement history is paginated
The system SHALL paginate the settled settlement history on the overview page.

#### Scenario: Merchant moves between settlement history pages
- **WHEN** the merchant has more settled settlements than fit on one page
- **THEN** the system shows pagination controls for the settlement table
- **AND** changing the page updates the visible settlement rows without changing the current search term or date filter
