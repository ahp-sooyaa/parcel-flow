## MODIFIED Requirements

### Requirement: Rider marks parcel delivered with proof

The system SHALL allow an active rider to mark an assigned `on_the_way` parcel as `delivered` only after providing delivery proof photo data, and only while the parcel has no active delivery failure note. The web rider page and the mobile API SHALL apply the same rules through one shared operation.

#### Scenario: Mark delivered is unavailable while failure note exists

- **WHEN** an assigned `on_the_way` parcel has a stored `delivery_failure_note`
- **THEN** the expanded rider parcel card does not show `Mark Delivered`

#### Scenario: Server rejects delivery while failure note is active

- **WHEN** a mark delivered request targets an assigned `on_the_way` parcel that has an active delivery failure note
- **THEN** the system rejects the request without storing a proof photo, changing parcel data, or creating financial items

#### Scenario: Rider opens mark delivered dialog

- **WHEN** a rider expands an assigned `on_the_way` parcel card and clicks `Mark Delivered`
- **THEN** the system displays a shadcn dialog showing the collection amount for that parcel
- **AND** the dialog includes a delivery proof photo upload control

#### Scenario: Mobile proof capture uses camera-first input

- **WHEN** the delivery proof upload control is used on a compatible mobile browser
- **THEN** the system allows the rider to open the phone camera and capture a photo directly
- **AND** the captured photo appears in the dialog before submission

#### Scenario: Desktop proof upload remains available

- **WHEN** the delivery proof upload control is used on a desktop browser or a mobile browser without camera capture support
- **THEN** the system allows selecting an image file from the device
- **AND** the selected image appears in the dialog before submission

#### Scenario: Delivery proof is required

- **WHEN** a rider submits the mark delivered dialog without an image proof
- **THEN** the system rejects the request and displays a validation error without changing parcel data

#### Scenario: Unauthorized delivery completion is rejected

- **WHEN** a non-rider user, inactive rider, unrelated rider, or rider for a parcel not in `on_the_way` status submits a mark delivered request
- **THEN** the system rejects the request without changing parcel data or creating financial items

#### Scenario: Ineligible request stores no photo

- **WHEN** a mark delivered request is rejected because the parcel is missing, assigned to someone else, not `on_the_way`, or has an active failure note
- **THEN** the system rejects it before storing the proof photo

#### Scenario: Stored photo is removed when delivery fails

- **WHEN** the proof photo was stored but saving the delivery then fails
- **THEN** the system deletes that stored photo and reports the failure
