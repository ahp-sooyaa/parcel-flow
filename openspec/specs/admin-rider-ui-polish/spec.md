# admin-rider-ui-polish Specification

## Purpose
TBD - created by archiving change polish-admin-rider-parcel-ui. Update Purpose after archive.
## Requirements
### Requirement: Admin parcel editing SHALL support saving parcel detail fields

The system SHALL let an admin submit parcel edits successfully from the parcel edit sheet for the parcel detail fields already owned by that form, without introducing parcel status or rider-assignment controls into the edit surface.

#### Scenario: Admin saves an updated parcel

- **WHEN** an authorized admin changes one or more parcel fields in the edit parcel sheet and clicks `Save Changes`
- **THEN** the system persists the updated parcel details through server-side validation and closes or refreshes the parcel UI with the saved values visible

#### Scenario: Admin sees only parcel detail controls in the edit form

- **WHEN** an authorized admin opens the parcel edit sheet
- **THEN** the form includes parcel detail fields such as merchant, receiver, township, delivery fee, note, and COD-related inputs
- **AND** parcel status changes and rider assignment remain handled from their dedicated workflows instead of this form

### Requirement: Failure-note dialogs SHALL show textarea-based active-note text only

The system SHALL present parcel failure notes for rider and admin users in a textarea bound to the active failure note text, and SHALL NOT display serialized note-history arrays or note status metadata in the visible field.

#### Scenario: Rider views an existing failure note

- **WHEN** a rider opens the failure-note dialog for a parcel with an active failure note
- **THEN** the textarea shows only the active note text in editable plain-text form

#### Scenario: Admin reviews an existing failure note

- **WHEN** an admin opens the failure-note dialog or review surface for a parcel with an active failure note
- **THEN** the visible textarea field shows only the active note text and not raw JSON-like note-history content

### Requirement: Rider parcel cards SHALL remain expanded

The system SHALL render rider parcel cards in their detailed state by default and SHALL NOT require or offer per-card collapse or expand toggling.

#### Scenario: Rider opens the parcel card list

- **WHEN** the rider parcel page loads with assigned parcels
- **THEN** each visible parcel card shows the detailed content and action area without requiring a card-header toggle

### Requirement: Shared parcel presentation SHALL adapt to rider-facing context

The system SHALL hide merchant information from riders in the shared parcel detail sheet and SHALL present the `canceled_returned` status label to users as `Canceled` while preserving the stored backend status value.

#### Scenario: Rider opens parcel detail

- **WHEN** the current user role is `rider` and the rider opens parcel detail
- **THEN** the shared parcel detail sheet omits merchant information while continuing to show the rest of the parcel details

#### Scenario: User views a canceled_returned parcel

- **WHEN** any user-facing parcel badge or label renders a parcel whose stored status is `canceled_returned`
- **THEN** the UI label reads `Canceled`

### Requirement: Admin support surfaces SHALL show the requested UI polish states

The system SHALL provide the requested UI consistency changes across settlements, users, townships, rider assignment, and selection controls.

#### Scenario: Settlements table has no rows

- **WHEN** the settlements page loads with an empty settlements collection
- **THEN** the settlements table area shows an explicit empty state instead of a blank table body

#### Scenario: Edit user password reset is independent from saving account changes

- **WHEN** an admin opens the edit user sheet
- **THEN** the `Forgot password` action is presented outside the main save form and can be triggered without submitting `Save Changes`

#### Scenario: Disabled checkboxes are visually distinct

- **WHEN** a checkbox is disabled in a parcel selection or related workflow
- **THEN** its styling clearly differs from an enabled clickable checkbox

#### Scenario: Township detail dialog matches user-detail presentation pattern

- **WHEN** an admin opens township details
- **THEN** the dialog styling follows the same visual pattern used by the user detail dialog rather than the older compact dialog layout

#### Scenario: Assign rider dialog shows trimmed summary metrics

- **WHEN** an admin opens the assign rider dialog
- **THEN** the dialog does not show summary tiles for selected parcel count, total COD amount, total delivery fee, or return-ready parcel count

#### Scenario: Assign rider dialog keeps expected-collection summary

- **WHEN** an admin opens the assign rider dialog
- **THEN** the dialog still shows total expected collection, rider current expected collection, and after-assignment expected collection

