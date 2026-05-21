## ADDED Requirements

### Requirement: Admin failure indicator
The system SHALL show a red failure warning indicator beside the parcel code on the admin parcel list when a parcel has an unresolved rider delivery failure report.

#### Scenario: Show unresolved failure warning
- **WHEN** a super admin or office admin views a parcel with status `on_the_way`, a non-empty `delivery_failure_note`, and an assigned rider
- **THEN** the parcel row displays a red warning icon immediately to the right of the parcel code

#### Scenario: Hide warning after admin decision
- **WHEN** a parcel is no longer awaiting admin failure review because its status is `postpone`, `canceled_returned`, `delivered`, or `returned_to_merchant`
- **THEN** the parcel row does not display the unresolved failure warning icon

#### Scenario: Hide admin-only warning from non-admin users
- **WHEN** a merchant or rider views a parcel list
- **THEN** the unresolved failure warning control is not displayed

### Requirement: Failure note review dialog
The system SHALL let super admins and office admins open a dialog from the failure warning indicator to review the rider failure note and choose an allowed failure decision.

#### Scenario: Open failure review dialog
- **WHEN** a super admin or office admin clicks the failure warning icon for an unresolved failed parcel
- **THEN** the system opens a dialog showing the parcel code, rider failure note, and `Postpone` and `Return Merchant` action buttons

#### Scenario: Prevent empty failure note review
- **WHEN** a parcel has no `delivery_failure_note`
- **THEN** the system does not expose the failure review dialog action for that parcel

### Requirement: Postpone failed parcel
The system SHALL allow super admins and office admins to mark an unresolved failed parcel as `postpone` after reviewing the rider failure note.

#### Scenario: Admin postpones failed parcel
- **WHEN** a super admin or office admin clicks `Postpone` for an eligible parcel with status `on_the_way`, a non-empty `delivery_failure_note`, and an assigned rider
- **THEN** the system sets `status = postpone`, clears `rider_id`, clears `assigned_at`, writes a parcel status log, and closes or refreshes the dialog state

#### Scenario: Postpone removes rider expected collection
- **WHEN** a parcel is postponed after failure review
- **THEN** the previously assigned rider's expected collection no longer includes that parcel's COD amount or delivery fee

#### Scenario: Postpone creates no financial items
- **WHEN** a parcel is postponed after failure review
- **THEN** the system does not create merchant settlement financial items, rider payout financial items, delivered timestamps, collected timestamps, or return timestamps

### Requirement: Mark failed parcel for merchant return
The system SHALL allow super admins and office admins to mark an unresolved failed parcel as `canceled_returned` after reviewing the rider failure note.

#### Scenario: Admin marks parcel for return handling
- **WHEN** a super admin or office admin clicks `Return Merchant` for an eligible parcel with status `on_the_way`, a non-empty `delivery_failure_note`, and an assigned rider
- **THEN** the system sets `status = canceled_returned`, clears `rider_id`, clears `assigned_at`, writes a parcel status log, and closes or refreshes the dialog state

#### Scenario: Return handling removes rider expected collection
- **WHEN** a parcel is marked `canceled_returned` after failure review
- **THEN** the previously assigned rider's expected collection no longer includes that parcel's COD amount or delivery fee

#### Scenario: Return handling does not settle return fee
- **WHEN** a parcel is marked `canceled_returned` after failure review
- **THEN** the system does not create a delivery fee deduction financial item until the parcel later becomes `returned_to_merchant`

### Requirement: Failure decision authorization and eligibility
The system SHALL enforce admin-only authorization and parcel eligibility on the server before writing a failure decision.

#### Scenario: Non-admin failure decision rejected
- **WHEN** a merchant or rider submits a failure decision request
- **THEN** the system rejects the request before updating the parcel

#### Scenario: Ineligible status rejected
- **WHEN** a failure decision request targets a parcel whose status is not `on_the_way`
- **THEN** the system rejects the request and leaves the parcel unchanged

#### Scenario: Missing failure note rejected
- **WHEN** a failure decision request targets a parcel without a non-empty `delivery_failure_note`
- **THEN** the system rejects the request and leaves the parcel unchanged

#### Scenario: Already handled failure rejected
- **WHEN** a failure decision request targets a parcel that no longer has an assigned rider because another admin already handled it
- **THEN** the system rejects the request and leaves the parcel unchanged

### Requirement: Follow-up assignment after failure decision
The system SHALL preserve the retry and merchant-return assignment rules after an admin failure decision.

#### Scenario: Postponed parcel can be assigned for retry
- **WHEN** a parcel has status `postpone` and no assigned rider
- **THEN** a super admin or office admin can assign it to a rider for retry delivery

#### Scenario: Retry assignment resets postponed parcel status
- **WHEN** a super admin or office admin assigns an unassigned `postpone` parcel to a rider
- **THEN** the system sets `rider_id`, sets `assigned_at`, and changes the parcel status to `at_office`

#### Scenario: Return-ready parcel can be assigned
- **WHEN** a parcel has status `canceled_returned` and no assigned rider
- **THEN** a super admin or office admin can assign it to a rider for merchant return handling without changing its status
