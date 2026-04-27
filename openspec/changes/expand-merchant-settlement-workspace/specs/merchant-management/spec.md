## MODIFIED Requirements

### Requirement: Merchant detail exposes COD settlement entry points for authorized staff
The system SHALL show merchant settlement workspace entry points on merchant detail only to authorized internal users. Merchant detail SHALL expose one dominant `Open Settlement Workspace` action near the merchant header or within a dedicated financial-actions section. Summary cards SHALL keep contextual shortcut buttons that open that same workspace with preset filters or preselection. Merchant detail SHALL continue to expose settlement history for review and fulfillment.

#### Scenario: Authorized staff sees dominant workspace action
- **WHEN** an authorized internal user opens a merchant detail page
- **THEN** the page shows one clear `Open Settlement Workspace` action for that merchant

#### Scenario: COD in Held card keeps contextual shortcut
- **WHEN** an authorized internal user opens a merchant detail page with COD funds in held state
- **THEN** the `COD in Held` stat card exposes a `Process Settlement` shortcut that opens the merchant settlement workspace with delivered COD settlement candidates preselected

#### Scenario: Pending Delivery Fee card opens fee-resolution shortcut
- **WHEN** an authorized internal user opens a merchant detail page with open delivery-fee charges that need settlement handling
- **THEN** the `Pending Delivery Fee` card exposes a `Resolve Fees` shortcut that opens the merchant settlement workspace prefiltered to fee-related debit candidates

#### Scenario: Returned card opens return-handling shortcut
- **WHEN** an authorized internal user opens a merchant detail page with returned parcels that need financial handling
- **THEN** the `Returned` card exposes a `Handle Returns` shortcut that opens the merchant settlement workspace prefiltered to returned settlement candidates

#### Scenario: Unauthorized user does not see settlement controls
- **WHEN** a user without merchant settlement permissions opens a merchant detail page
- **THEN** the system does not render settlement workspace controls or settlement history actions for that user

#### Scenario: Merchant detail opens settlement history
- **WHEN** an authorized internal user opens the settlement history tab or view on merchant detail
- **THEN** the system returns settlement history scoped to the current merchant only

### Requirement: Merchant detail settlement mode preserves merchant scope
The system SHALL keep settlement mode scoped to the merchant detail record that launched it. Settlement mode MUST preserve any shortcut preset supplied by the launching merchant-detail action while still preventing selection of another merchant's candidates. Settlement history MUST NOT include settlements for another merchant.

#### Scenario: Settlement mode lists only current merchant candidates
- **WHEN** an authorized user enters settlement mode from a merchant detail page
- **THEN** every ready or blocked settlement candidate row belongs to that merchant

#### Scenario: Generic workspace action opens unfiltered workspace
- **WHEN** an authorized user enters settlement mode from the `Open Settlement Workspace` action
- **THEN** the system opens the full merchant-scoped workspace without applying a shortcut preset

#### Scenario: Shortcut action preserves preset
- **WHEN** an authorized user enters settlement mode from a merchant-detail settlement shortcut
- **THEN** the system opens the same merchant-scoped workspace with the shortcut's preset filter or preselection applied

#### Scenario: Cross-merchant settlement selection is rejected
- **WHEN** a settlement generation request includes a settlement candidate that belongs to another merchant
- **THEN** the system rejects the request and does not create a settlement
