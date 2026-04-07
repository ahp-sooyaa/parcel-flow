## MODIFIED Requirements

### Requirement: Merchant detail access supports self-scope for merchant role
The system SHALL define merchant-role detail access as self-scope only and SHALL allow parcel-related content to appear only when the requested merchant record belongs to the current merchant user. The system SHALL require `merchant.view` for merchant self-detail access and MUST NOT require `parcel-list.view` in order to show the merchant-owned parcel list inside that same detail page.

#### Scenario: Merchant owner opens own merchant detail with parcel list
- **WHEN** an authenticated merchant user with `merchant.view` requests the merchant profile linked to their account
- **THEN** the system allows access and returns the merchant detail view with only that merchant's related parcels

#### Scenario: Merchant user requests another merchant detail
- **WHEN** an authenticated merchant user requests a merchant detail page for a different merchant record
- **THEN** the system denies access to that route and does not return parcel data

#### Scenario: Merchant user without merchant view cannot access self detail
- **WHEN** an authenticated merchant-linked user without `merchant.view` requests their own merchant detail page
- **THEN** the system denies access even if the merchant linkage is valid
