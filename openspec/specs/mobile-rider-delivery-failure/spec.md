# mobile-rider-delivery-failure Specification

## Purpose

TBD - created by archiving change mobile-rider-delivery-failure. Update Purpose after archive.

## Requirements

### Requirement: Rider failure note API

The system SHALL provide `POST`, `PATCH` and `DELETE /api/mobile/v1/rider/parcels/{parcelId}/failure-note` to report, edit and delete the active delivery failure note on the signed-in rider's assigned `on_the_way` parcel, using the same shared operations as the web rider page.

#### Scenario: Rider reports a failure

- **WHEN** an active rider posts `{ note }` with a non-empty note of at most 500 characters for a parcel assigned to them with status `on_the_way` and no active failure note
- **THEN** the system responds with HTTP 200 and `{ ok: true, message, data: { parcelId, activeFailureNote } }` with the trimmed note
- **AND** the parcel has a new active failure note entry with that text
- **AND** the parcel status, rider assignment, collection fields and financial items are unchanged

#### Scenario: Rider edits the active note

- **WHEN** an active rider sends `PATCH` with a valid `{ note }` for their `on_the_way` parcel that has an active failure note
- **THEN** the system responds with HTTP 200 and the new note in `data.activeFailureNote`
- **AND** only the active entry's text changes

#### Scenario: Rider deletes the active note

- **WHEN** an active rider sends `DELETE` for their `on_the_way` parcel that has an active failure note
- **THEN** the system responds with HTTP 200 and `data.activeFailureNote` set to `null`
- **AND** the active entry is removed, inactive history entries are kept, and the parcel can be marked delivered again

#### Scenario: Invalid request

- **WHEN** a `POST` or `PATCH` body is not valid JSON, the parcel id is not a UUID, or the note is empty after trimming or longer than 500 characters
- **THEN** the system responds with HTTP 400 and `{ ok: false, message }` and changes nothing

#### Scenario: Not signed in or not a rider

- **WHEN** the request has no session, or the user is inactive or not a rider
- **THEN** the system responds with HTTP 401 or 403 and changes nothing

#### Scenario: Parcel missing or assigned to another rider

- **WHEN** the parcel does not exist, is deleted, or is assigned to someone other than the signed-in rider
- **THEN** the system responds with HTTP 404 and the message "Parcel not found." in every case, and changes nothing

#### Scenario: Note state or parcel state conflicts

- **WHEN** the parcel is not `on_the_way`, a `POST` targets a parcel that already has an active note, or a `PATCH` or `DELETE` targets a parcel without one
- **THEN** the system responds with HTTP 409 and a message saying why, and changes nothing

#### Scenario: Path identifies the parcel

- **WHEN** a request body also contains a `parcelId`
- **THEN** the system acts only on the parcel in the path

#### Scenario: Unexpected failure

- **WHEN** saving the note fails for a reason other than the rules above
- **THEN** the system responds with HTTP 500 without internal error details

### Requirement: Failure notes in the mobile app

The mobile app SHALL let a rider report, edit and delete the active failure note on an assigned `on_the_way` parcel from its detail screen, and SHALL show on the parcel's card that a failure was reported.

#### Scenario: Report failure is offered

- **WHEN** a rider opens the detail screen of an `on_the_way` parcel without an active failure note
- **THEN** the screen shows "Report failure" alongside "Mark delivered"

#### Scenario: Active note is shown with an edit action

- **WHEN** a rider opens the detail screen of an `on_the_way` parcel with an active failure note
- **THEN** the screen shows the note text and "Edit note"
- **AND** it does not show "Report failure" or "Mark delivered"

#### Scenario: Failure actions are hidden for other statuses

- **WHEN** a rider opens the detail screen of a parcel that is not `on_the_way`
- **THEN** the screen shows neither "Report failure" nor "Edit note"

#### Scenario: Card explains the missing delivery action

- **WHEN** an `on_the_way` parcel with an active failure note appears on the To deliver tab
- **THEN** its card shows "Failure reported" instead of "Mark delivered"

#### Scenario: Rider writes a note with quick reasons

- **WHEN** a rider taps a quick reason on the Failure note screen
- **THEN** the reason fills an empty note, or is added on a new line to an existing one
- **AND** the rider can still edit the text, which is limited to 500 characters with a visible count

#### Scenario: Save requires a changed, non-empty note

- **WHEN** the trimmed note is empty, or in edit mode is unchanged
- **THEN** the save button is disabled

#### Scenario: Saving closes the screen

- **WHEN** a report or edit succeeds
- **THEN** the Failure note screen closes and the detail screen shows the saved note

#### Scenario: Deleting asks for confirmation

- **WHEN** a rider taps "Delete note" and confirms
- **THEN** the app deletes the note, the screen closes, and the detail screen offers "Report failure" and "Mark delivered" again
- **AND** cancelling the confirmation changes nothing

#### Scenario: Error keeps the text

- **WHEN** saving or deleting fails
- **THEN** the screen shows the error and keeps the rider's text so they can retry
- **AND** after a 404 or 409 the screen shows the parcel's current state

#### Scenario: Parcel no longer eligible

- **WHEN** the Failure note screen opens, or refetches, for a parcel that is not `on_the_way` or no longer assigned to the rider
- **THEN** it explains why and offers no form

#### Scenario: Note reported elsewhere

- **WHEN** the screen opened to report a failure but the parcel now has an active note
- **THEN** it switches to editing that note and says a note was already reported
