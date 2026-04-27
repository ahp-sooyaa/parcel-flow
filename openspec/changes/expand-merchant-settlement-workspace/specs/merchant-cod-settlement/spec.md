## MODIFIED Requirements

### Requirement: Authorized staff can enter merchant settlement mode from COD in Held
The system SHALL provide a settlement workspace on the merchant detail page that is opened from merchant-detail entry points rather than separate finance pages. Settlement mode MUST stay scoped to the current merchant and MUST present ready and blocked merchant settlement candidates rather than a COD-only parcel list. Ready candidates MAY include COD remittance credits, merchant-billed delivery fee debits, and verified refund credits. Blocked candidates MUST explain why they cannot yet be settled.

#### Scenario: Authorized user starts settlement workspace from generic action
- **WHEN** an authorized internal user activates `Open Settlement Workspace` from a merchant detail page
- **THEN** the system shows the merchant settlement workspace for that merchant with current ready and blocked settlement candidates

#### Scenario: Authorized user starts delivered COD shortcut
- **WHEN** an authorized internal user activates `Process Settlement` from the `COD in Held` stat card on a merchant detail page
- **THEN** the system shows the merchant settlement workspace for that merchant with delivered COD settlement candidates preselected

#### Scenario: Authorized user starts fee shortcut
- **WHEN** an authorized internal user activates `Resolve Fees` from the `Pending Delivery Fee` stat card on a merchant detail page
- **THEN** the system shows the merchant settlement workspace for that merchant with fee-related debit candidates prefiltered

#### Scenario: Authorized user starts return shortcut
- **WHEN** an authorized internal user activates `Handle Returns` from the `Returned` stat card on a merchant detail page
- **THEN** the system shows the merchant settlement workspace for that merchant with returned settlement candidates prefiltered

#### Scenario: Blocked candidates are shown with reasons
- **WHEN** settlement mode loads for a merchant with parcel-derived financial items that are not yet ready for settlement
- **THEN** the system keeps those candidates out of the selectable list and shows them in a blocked section with operator-readable reasons

#### Scenario: Unauthorized user cannot enter settlement mode
- **WHEN** a user without merchant settlement generation permission attempts to enter settlement mode
- **THEN** the system denies access to the settlement workspace and does not return merchant settlement candidate data

### Requirement: Settlement picker summarizes selected parcels before generation
The system SHALL display a checkbox column in settlement mode and SHALL show a floating settlement bar with the selected candidate count, selected credits total, selected debits total, selected net total, and the resulting document direction. The generate action MUST remain disabled until at least one ready candidate is selected and required settlement details for the resulting direction are present.

#### Scenario: Selected candidate summary updates
- **WHEN** an authorized user selects or clears ready settlement candidates in settlement mode
- **THEN** the settlement bar updates the selected count, credits total, debits total, net total, and resulting remit-or-invoice direction using the selected rows

#### Scenario: Generate action disabled with no selection
- **WHEN** settlement mode is open and no ready settlement candidate is selected
- **THEN** the system disables the generate settlement action

#### Scenario: Generate action enabled with valid selection
- **WHEN** settlement mode is open and the user selects one or more ready settlement candidates with all required settlement details for the resulting document direction
- **THEN** the system enables the generate settlement action

#### Scenario: COD shortcut starts with ready selection
- **WHEN** settlement mode is opened from `Process Settlement`
- **THEN** the sticky settlement summary reflects the preselected delivered COD candidates immediately

#### Scenario: Fee and return shortcuts filter without auto-selecting unrelated items
- **WHEN** settlement mode is opened from `Resolve Fees` or `Handle Returns`
- **THEN** the workspace narrows the visible ready candidate set to the matching slice and does not automatically select unrelated candidates outside that slice

### Requirement: Settlement generation creates audit records and locks selected parcels
The system SHALL generate a `pending` merchant settlement from selected eligible merchant financial items in one server-side transaction. The transaction MUST create the settlement record, snapshot the relevant bank details for the document direction, create one settlement item per selected merchant financial item, snapshot item-level financial values, and lock the selected merchant financial items against other active settlements.

#### Scenario: Generate settlement succeeds for eligible selection
- **WHEN** an authorized user submits selected ready merchant financial items and valid bank details for settlement generation
- **THEN** the system creates a pending merchant settlement, creates settlement item snapshots for each selected merchant financial item, records the creator, snapshots the required bank details, and removes those candidates from the available-to-settle pool

#### Scenario: Generation derives remit document from positive net
- **WHEN** the selected merchant financial items produce a positive net amount
- **THEN** the generated settlement document is recorded as a remit and the settlement snapshots preserve the selected credits, debits, and net outcome

#### Scenario: Generation derives invoice document from negative net
- **WHEN** the selected merchant financial items produce a negative net amount
- **THEN** the generated settlement document is recorded as an invoice and the settlement snapshots preserve the selected credits, debits, and net outcome

#### Scenario: Generation rejects stale or already locked selection
- **WHEN** a selected merchant financial item no longer satisfies settlement eligibility at generation time
- **THEN** the system rejects settlement generation and does not create a partial settlement

### Requirement: Active settlements cannot overlap parcels
The system MUST prevent a merchant financial item from belonging to more than one active merchant settlement. Active settlements include generated settlements that are pending, in progress, or paid; cancelled and rejected settlements do not keep merchant financial items locked.

#### Scenario: Concurrent generation attempts same candidate
- **WHEN** two authorized users attempt to generate active settlements containing the same ready merchant financial item
- **THEN** only one settlement can lock that candidate and the other generation attempt fails without creating an overlapping active settlement

#### Scenario: Locked candidate is unavailable to other settlement runs
- **WHEN** a merchant financial item is linked to a pending or in-progress settlement
- **THEN** that item does not appear in any ready-to-settle list for any user

#### Scenario: Paid candidate remains unavailable
- **WHEN** a merchant financial item belongs to a paid settlement
- **THEN** that item remains unavailable for future settlement generation

### Requirement: Settlement history supports review and payment confirmation
The system SHALL show merchant settlement history to authorized users and SHALL allow authorized checker users to mark a pending or in-progress settlement as paid only after providing payment proof and reference details appropriate to the document direction.

#### Scenario: Authorized user views settlement history
- **WHEN** an authorized user opens the settlement history for a merchant
- **THEN** the system lists settlement records for that merchant with document direction, credits total, debits total, net amount, status, counterpart bank snapshot, creator, confirmer, and timestamps

#### Scenario: Checker confirms remit with outbound proof
- **WHEN** an authorized checker uploads valid outbound payment proof and enters a reference number for a pending or in-progress remit settlement
- **THEN** the system marks the settlement as paid, records the confirmer, stores the proof reference, and closes the linked merchant financial items

#### Scenario: Checker confirms invoice with inbound proof
- **WHEN** an authorized checker uploads valid inbound payment proof and enters a reference number for a pending or in-progress invoice settlement
- **THEN** the system marks the settlement as paid, records the confirmer, stores the proof reference, and closes the linked merchant financial items

#### Scenario: Confirmation requires proof and reference
- **WHEN** an authorized checker attempts to mark a settlement paid without required payment proof or reference details
- **THEN** the system rejects the confirmation and keeps the settlement unpaid

### Requirement: Pending settlements can be cancelled or rejected with parcel release
The system SHALL allow authorized users to cancel or reject a pending or in-progress settlement. Cancellation or rejection MUST release linked merchant financial items back to an open state and remove their active settlement lock while preserving the settlement record and item snapshots for audit.

#### Scenario: Authorized user cancels pending settlement
- **WHEN** an authorized user cancels a pending settlement
- **THEN** the system marks the settlement as cancelled, releases the linked merchant financial items, and returns those candidates to the settlement workspace

#### Scenario: Authorized user rejects in-progress settlement
- **WHEN** an authorized user rejects an in-progress settlement
- **THEN** the system marks the settlement as rejected, releases the linked merchant financial items, and returns those candidates to the settlement workspace

#### Scenario: Paid settlement cannot be cancelled or rejected
- **WHEN** a user attempts to cancel or reject a paid settlement
- **THEN** the system rejects the action and preserves the paid settlement and linked merchant financial item states

### Requirement: Paid settlement totals are immutable
The system MUST preserve the financial totals of a paid merchant settlement. Paid settlement item snapshots, credits total, debits total, net amount, bank snapshot, payment proof, reference number, creator, and confirmer fields MUST NOT be editable through parcel update or settlement update workflows.

#### Scenario: Paid settlement detail uses stored snapshots
- **WHEN** a user views a paid settlement after related parcel or payment data has changed
- **THEN** the system displays settlement totals and item amounts from the stored settlement snapshots

#### Scenario: Paid settlement financial fields cannot be changed
- **WHEN** a user attempts to change a paid settlement totals, item snapshots, or payment proof through a server action
- **THEN** the system rejects the change and preserves the original paid settlement record
