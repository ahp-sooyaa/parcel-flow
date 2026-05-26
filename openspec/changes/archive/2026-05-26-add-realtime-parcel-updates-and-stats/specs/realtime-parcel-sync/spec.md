## ADDED Requirements

### Requirement: Rider assignment changes sync to affected dashboards in realtime

The system SHALL reflect parcel rider-assignment changes on subscribed rider, admin, and merchant parcel views without requiring a manual page reload.

#### Scenario: Admin assigns a parcel to a rider

- **WHEN** an admin assigns a parcel to a rider successfully
- **THEN** the assigned rider's subscribed parcel view shows the parcel without a manual reload
- **AND** subscribed admin parcel views show the updated assignment state without a manual reload
- **AND** subscribed merchant parcel views show the updated assignment state without a manual reload

#### Scenario: Admin reassigns a parcel to a different rider

- **WHEN** an admin changes a parcel from one rider assignment to another successfully
- **THEN** the previous rider's subscribed parcel view removes or updates that parcel without a manual reload
- **AND** the new rider's subscribed parcel view shows the parcel without a manual reload
- **AND** subscribed admin and merchant parcel views show the new assignment state without a manual reload

### Requirement: Rider delivery outcome changes sync to affected dashboards in realtime

The system SHALL reflect rider delivery completion and rider failure-note changes on subscribed rider, admin, and merchant parcel views without requiring a manual page reload.

#### Scenario: Rider marks a parcel delivered

- **WHEN** a rider successfully marks an assigned parcel as `delivered`
- **THEN** the rider's subscribed parcel view updates the parcel status and delivery state without a manual reload
- **AND** subscribed admin parcel views update that parcel's status and delivery state without a manual reload
- **AND** subscribed merchant parcel views update that parcel's status and delivery state without a manual reload

#### Scenario: Rider reports delivery failure

- **WHEN** a rider successfully saves a delivery failure note for an assigned `on_the_way` parcel
- **THEN** the rider's subscribed parcel view shows the failure-note state without a manual reload
- **AND** subscribed admin parcel views show the failure-note state without a manual reload
- **AND** subscribed merchant parcel views show the failure-note state without a manual reload

#### Scenario: Rider edits or deletes a delivery failure note

- **WHEN** a rider successfully edits or deletes the delivery failure note for an assigned `on_the_way` parcel
- **THEN** the rider's subscribed parcel view reflects the updated failure-note state without a manual reload
- **AND** subscribed admin parcel views reflect the updated failure-note state without a manual reload
- **AND** subscribed merchant parcel views reflect the updated failure-note state without a manual reload

### Requirement: Affected summary cards refresh from realtime parcel changes

The system SHALL refresh the summary cards affected by parcel assignment or delivery-state changes when a subscribed dashboard receives relevant realtime parcel updates.

#### Scenario: Merchant overview delivery metrics refresh after rider delivery completion

- **WHEN** a merchant overview page is open and one of that merchant's parcels changes to `delivered`
- **THEN** the merchant overview summary cards refresh without a manual reload
- **AND** the delivered-parcel count reflects the new parcel state
- **AND** the on-the-way count no longer includes that parcel
- **AND** COD-based totals reflect the delivered parcel according to existing business rules

#### Scenario: Merchant overview counters stay scoped to the current merchant

- **WHEN** realtime parcel updates are received for parcels belonging to other merchants
- **THEN** the open merchant overview summary cards do not change

#### Scenario: Non-summary parcel updates do not change existing business calculations

- **WHEN** a subscribed dashboard refreshes stats because of a realtime parcel update
- **THEN** the resulting card values use the same server-side business calculations as the non-realtime page load

### Requirement: Realtime subscriptions respect existing role-based data visibility

The system SHALL only deliver realtime parcel updates to authenticated users who are already allowed to view those parcel rows through the existing application access model.

#### Scenario: Rider only receives assigned parcel updates

- **WHEN** a rider has a subscribed parcel view open
- **THEN** the realtime subscription only delivers parcel updates for rows visible to that rider's account under the existing authorization rules

#### Scenario: Merchant only receives own parcel updates

- **WHEN** a merchant has a subscribed parcel or overview view open
- **THEN** the realtime subscription only delivers parcel updates for rows belonging to that merchant under the existing authorization rules

#### Scenario: Admin receives operational parcel updates

- **WHEN** an admin or super admin has a subscribed operational parcel view open
- **THEN** the realtime subscription delivers parcel updates for the operational parcel rows that role is already allowed to view

#### Scenario: Unauthorized user does not receive parcel updates

- **WHEN** an unauthenticated user or an authenticated user outside the allowed row scope attempts to open a subscribed view
- **THEN** the system does not expose realtime parcel rows outside the existing authorization boundary

### Requirement: Realtime behavior is additive to existing mutations

The system SHALL add realtime freshness without changing the existing business behavior of parcel mutations.

#### Scenario: Assignment logic remains unchanged

- **WHEN** realtime synchronization is enabled for parcel assignment views
- **THEN** admin assignment actions keep the same validation, side effects, and persisted parcel state they had before realtime was added

#### Scenario: Delivery logic remains unchanged

- **WHEN** realtime synchronization is enabled for rider delivery actions
- **THEN** rider delivery completion and failure-report actions keep the same validation, side effects, and persisted parcel state they had before realtime was added
