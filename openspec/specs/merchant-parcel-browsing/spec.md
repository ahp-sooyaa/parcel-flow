# merchant-parcel-browsing Specification

## Purpose
TBD - created by archiving change add-merchant-overview-and-parcel-filters. Update Purpose after archive.
## Requirements
### Requirement: Merchant parcels page supports merchant-scoped search

The system SHALL let a merchant search their parcels from `dashboard/merchant/parcels` by recipient name or recipient phone number.

#### Scenario: Merchant searches parcels by recipient name

- **WHEN** a merchant enters part or all of a recipient name in the parcel search input
- **THEN** the system filters the parcel list to the current merchant's parcels whose recipient name matches the search term

#### Scenario: Merchant searches parcels by recipient phone number

- **WHEN** a merchant enters part or all of a recipient phone number in the parcel search input
- **THEN** the system filters the parcel list to the current merchant's parcels whose recipient phone number matches the search term

### Requirement: Merchant parcels page supports date filtering

The system SHALL let a merchant filter their parcels by created date using a shadcn date picker control.

#### Scenario: Merchant filters parcels by date

- **WHEN** a merchant selects a date from the parcel page date picker filter
- **THEN** the system filters the parcel list to the current merchant's parcels whose created date matches the selected date

#### Scenario: Merchant clears the parcel date filter

- **WHEN** a merchant clears the selected parcel date filter
- **THEN** the system returns to showing parcels based on the remaining active search term and status tab

### Requirement: Merchant parcels page supports requested status tabs

The system SHALL provide parcel status tabs for `all`, `On the way`, and `Delivered` on the merchant parcels page.

#### Scenario: Merchant views all parcels

- **WHEN** a merchant selects the `all` status tab
- **THEN** the system shows merchant-owned parcels regardless of status, subject to the active search term and date filter

#### Scenario: Merchant views on the way parcels

- **WHEN** a merchant selects the `On the way` status tab
- **THEN** the system shows only merchant-owned parcels whose status is `on_the_way`

#### Scenario: Merchant views delivered parcels

- **WHEN** a merchant selects the `Delivered` status tab
- **THEN** the system shows only merchant-owned parcels whose status is `delivered`

### Requirement: Merchant parcels page is paginated

The system SHALL paginate the merchant parcel list.

#### Scenario: Merchant navigates parcel pages

- **WHEN** the merchant has more parcels than fit on one page
- **THEN** the system shows pagination controls on the merchant parcels page
- **AND** changing the page preserves the active search term, selected date filter, and selected status tab

#### Scenario: Merchant filter combination has no matching parcels

- **WHEN** the merchant applies search, date, or status filters that match no parcels
- **THEN** the system shows an empty state in the parcel list area

