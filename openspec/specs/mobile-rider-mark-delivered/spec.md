# mobile-rider-mark-delivered Specification

## Purpose

TBD - created by archiving change mobile-rider-mark-delivered. Update Purpose after archive.

## Requirements

### Requirement: Rider mark delivered API

The system SHALL provide `POST /api/mobile/v1/rider/parcels/{parcelId}/deliver`, which accepts a delivery proof photo as `multipart/form-data` and marks the signed-in rider's assigned `on_the_way` parcel delivered, using the same shared operation as the web rider page.

#### Scenario: Rider delivers their own parcel

- **WHEN** an active rider posts a JPG, PNG, or WebP `proofImage` of at most 5 MB for a parcel assigned to them with status `on_the_way` and no active failure note
- **THEN** the system responds with HTTP 200 and `{ ok: true, message, data: { parcelId } }`
- **AND** the parcel is `delivered`, with the stored photo key and the collection fields set as on the web

#### Scenario: Invalid request

- **WHEN** the body is not multipart, the parcel id is not a UUID, or the photo is missing, larger than 5 MB, or not a JPG, PNG, or WebP image
- **THEN** the system responds with HTTP 400 and `{ ok: false, message }`, stores no photo, and changes nothing

#### Scenario: Not signed in or not a rider

- **WHEN** the request has no session, or the user is inactive or not a rider
- **THEN** the system responds with HTTP 401 or 403, stores no photo, and changes nothing

#### Scenario: Parcel missing or assigned to another rider

- **WHEN** the parcel does not exist, is deleted, or is assigned to someone other than the signed-in rider
- **THEN** the system responds with HTTP 404 and the message "Parcel not found." in every case, stores no photo, and changes nothing

#### Scenario: Parcel not on the way

- **WHEN** the rider's parcel has a status other than `on_the_way`, including one delivered a moment earlier
- **THEN** the system responds with HTTP 409, stores no photo, and changes nothing

#### Scenario: Active failure note

- **WHEN** the rider's `on_the_way` parcel has an active delivery failure note
- **THEN** the system responds with HTTP 409 and a message to resolve the failure note first, stores no photo, and changes nothing

#### Scenario: Demo rate limit

- **WHEN** demo mode is on and the rider has used up the shared per-minute delivery limit
- **THEN** the system responds with HTTP 429

#### Scenario: Unexpected failure

- **WHEN** storing the photo or saving the delivery fails for a reason other than the rules above
- **THEN** the system responds with HTTP 500 without internal error details, and removes any photo it stored for this request

### Requirement: Mark delivered in the mobile app

The mobile app SHALL let a rider mark an assigned `on_the_way` parcel delivered with a proof photo, from its card on the To deliver tab and from its detail screen.

#### Scenario: Mark delivered is offered

- **WHEN** a parcel is `on_the_way` and has no active failure note
- **THEN** its card and its detail screen show "Mark delivered", which opens the Mark delivered screen

#### Scenario: Mark delivered is not offered

- **WHEN** a parcel is not `on_the_way`, or has an active failure note
- **THEN** its card and detail screen do not show "Mark delivered"

#### Scenario: Amount to collect is shown

- **WHEN** the Mark delivered screen opens
- **THEN** it shows the parcel code, receiver, address, and the amount to collect in MMK

#### Scenario: Take the proof photo

- **WHEN** the rider taps "Take photo" and takes a picture
- **THEN** the app shows a preview of the photo with a way to retake it

#### Scenario: Choose from gallery

- **WHEN** the rider chooses "Choose from gallery" and picks an image
- **THEN** the app uses it as the proof photo, with the same preview and retake

#### Scenario: Camera permission denied

- **WHEN** the rider denies camera access
- **THEN** the app explains that the camera is needed, offers a way to open the phone's settings, and still offers choosing from the gallery

#### Scenario: Photo is compressed before upload

- **WHEN** the rider takes or chooses a photo
- **THEN** the app uploads a JPEG whose longest side is at most 1600 pixels, without the photo's location data

#### Scenario: Confirm requires a photo

- **WHEN** no proof photo has been taken or chosen
- **THEN** "Confirm delivered" is disabled

#### Scenario: Delivery saved

- **WHEN** the rider confirms and the server accepts the delivery
- **THEN** the screen shows that the parcel was marked delivered, and the parcel list, tab counts, and parcel detail refresh to show it as delivered

#### Scenario: Upload in progress

- **WHEN** the delivery request is in progress
- **THEN** "Confirm delivered" shows that it is busy and the screen cannot be dismissed until the server replies

#### Scenario: Delivery rejected or failed

- **WHEN** the server rejects the delivery or the request fails
- **THEN** the app shows the message, keeps the photo so the rider can try again, and refreshes the parcel so the screen shows its current state

#### Scenario: Parcel no longer eligible when opened

- **WHEN** the Mark delivered screen opens for a parcel that is no longer `on_the_way`, has an active failure note, or is no longer assigned to the rider
- **THEN** the screen explains why and offers no photo or confirm controls
