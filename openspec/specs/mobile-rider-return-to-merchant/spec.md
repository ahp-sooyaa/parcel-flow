# mobile-rider-return-to-merchant Specification

## Purpose

TBD - created by archiving change mobile-rider-return-to-merchant. Update Purpose after archive.

## Requirements

### Requirement: Rider return to merchant API

The system SHALL provide `POST /api/mobile/v1/rider/parcels/{parcelId}/return`, which completes the signed-in rider's assigned `canceled_returned` parcel as returned to its merchant, using the same shared operation as the web rider page.

#### Scenario: Rider completes their return

- **WHEN** an active rider posts for a parcel assigned to them with status `canceled_returned`
- **THEN** the system responds with HTTP 200 and `{ ok: true, message, data: { parcelId } }`
- **AND** the parcel is `returned_to_merchant` with its return time set, and the merchant delivery-fee deduction and the rider's merchant-return way item are created as on the web

#### Scenario: Invalid parcel id

- **WHEN** the parcel id is not a UUID
- **THEN** the system responds with HTTP 400 and changes nothing

#### Scenario: Not signed in or not a rider

- **WHEN** the request has no session, or the user is inactive or not a rider
- **THEN** the system responds with HTTP 401 or 403 and changes nothing

#### Scenario: Parcel missing or assigned to another rider

- **WHEN** the parcel does not exist, is deleted, or is assigned to someone other than the signed-in rider
- **THEN** the system responds with HTTP 404 and the message "Parcel not found." in every case, and changes nothing

#### Scenario: Parcel not awaiting return

- **WHEN** the rider's parcel has a status other than `canceled_returned`, including one returned a moment earlier
- **THEN** the system responds with HTTP 409, changes nothing, and creates no financial items

#### Scenario: Unexpected failure

- **WHEN** completing the return fails for a reason other than the rules above
- **THEN** the system responds with HTTP 500 without internal error details

### Requirement: Return to merchant in the mobile app

The mobile app SHALL let a rider see where an assigned `canceled_returned` parcel goes back to, and mark it returned to the merchant from its card on the To deliver tab and from its detail screen.

#### Scenario: Return card

- **WHEN** a `canceled_returned` parcel appears on the To deliver tab
- **THEN** its card shows "Return to" with the merchant name instead of an amount to collect, and a "Mark returned" button

#### Scenario: Return detail

- **WHEN** a rider opens the detail screen of a `canceled_returned` parcel
- **THEN** the screen shows a "Return to merchant" section with the merchant name, address, phone number as a call link when known, and "Mark returned"
- **AND** it does not show collection amounts

#### Scenario: Confirmation before returning

- **WHEN** the rider taps "Mark returned"
- **THEN** the app asks for confirmation, naming the parcel and the merchant, before sending anything
- **AND** cancelling changes nothing

#### Scenario: Return completed

- **WHEN** the rider confirms and the return succeeds
- **THEN** the app shows "Parcel returned to merchant." and the parcel moves from the To deliver tab to the Returned tab, with updated tab counts

#### Scenario: Return rejected

- **WHEN** the return request fails
- **THEN** the app shows the error message, and after a 404 or 409 it shows the parcel's current state

#### Scenario: Return controls only for returns

- **WHEN** a parcel is not `canceled_returned`
- **THEN** neither its card nor its detail screen shows "Mark returned" or the merchant's return contact
