## ADDED Requirements

### Requirement: Rider start delivery API

The system SHALL provide `POST /api/mobile/v1/rider/parcels/start-delivery`, which moves the signed-in rider's selected `at_office` parcels to `on_the_way` using the same shared operation as the web rider page.

#### Scenario: Rider starts their own parcels

- **WHEN** an active rider posts `{ parcelIds }` listing one or more parcels assigned to them with status `at_office`
- **THEN** the system responds with HTTP 200 and `{ ok: true, message, data: { parcelIds } }`
- **AND** every listed parcel is `on_the_way`, with one pending `delivery_attempt` rider way payout for each

#### Scenario: Duplicate parcel ids

- **WHEN** the request lists the same parcel id more than once
- **THEN** the system starts that parcel once and returns it once in `data.parcelIds`

#### Scenario: Invalid request body

- **WHEN** the body is not JSON, `parcelIds` is empty, has more than 50 ids, or contains a value that is not a UUID
- **THEN** the system responds with HTTP 400 and `{ ok: false, message }` and changes nothing

#### Scenario: Not signed in or not a rider

- **WHEN** the request has no session, or the user is inactive or not a rider
- **THEN** the system responds with HTTP 401 or 403 and changes nothing

#### Scenario: Parcel missing or assigned to another rider

- **WHEN** any listed parcel does not exist, is deleted, or is assigned to someone other than the signed-in rider
- **THEN** the system responds with HTTP 404 and the same "One or more selected parcels were not found." message in every case
- **AND** no listed parcel changes status and no payout is created

#### Scenario: Parcel no longer at the office

- **WHEN** any listed parcel assigned to the rider has a status other than `at_office`, including one started a moment earlier
- **THEN** the system responds with HTTP 409 and `{ ok: false, message }`
- **AND** no listed parcel changes status and no payout is created

#### Scenario: Unexpected failure

- **WHEN** starting delivery fails for a reason other than the rules above
- **THEN** the system responds with HTTP 500 and the message "Unable to start delivery." without internal error details

#### Scenario: Web views stay fresh

- **WHEN** a start from the mobile API succeeds
- **THEN** the next read of the rider's parcel list, from the app or the web, shows the parcels as on the way rather than a cached earlier state

### Requirement: Start delivery in the mobile app

The mobile app SHALL let a rider start delivery for an assigned `at_office` parcel from its card on the To deliver tab and from its detail screen.

#### Scenario: Start one parcel from its card

- **WHEN** the rider taps "Start delivery" on an `at_office` card
- **THEN** the app starts that parcel without a confirmation dialog, and the list and counts refresh to show it on the way

#### Scenario: Start from the detail screen

- **WHEN** the rider taps "Start delivery" on the detail screen of an `at_office` parcel
- **THEN** the app starts that parcel and the detail refreshes to show it on the way

#### Scenario: Only at-office parcels can be started

- **WHEN** a parcel's status is anything other than `at_office`
- **THEN** its card and detail screen show no "Start delivery" button and its card has no selection checkbox

#### Scenario: Request in progress

- **WHEN** a start request is in progress
- **THEN** the pressed button shows that it is starting, and every start button and checkbox is disabled until the server replies

#### Scenario: Start rejected

- **WHEN** the server rejects a start
- **THEN** the app shows the server's message and refreshes the list and detail so they show the parcel's current state

### Requirement: Start several parcels in the mobile app

The mobile app SHALL let a rider select several `at_office` parcels on the To deliver tab and start them together.

#### Scenario: Select parcels

- **WHEN** the rider checks one or more `at_office` cards
- **THEN** a bar shows the number selected, their total amount to collect in MMK, a way to clear the selection, and a "Start delivery" button

#### Scenario: Confirm several

- **WHEN** two or more parcels are selected and the rider taps "Start delivery" in the bar
- **THEN** the app asks for confirmation showing the parcel count and total to collect, and starts them only if the rider confirms

#### Scenario: Cancel confirmation

- **WHEN** the rider cancels the confirmation
- **THEN** no request is sent and the selection stays

#### Scenario: One selected parcel

- **WHEN** exactly one parcel is selected and the rider taps "Start delivery" in the bar
- **THEN** the app starts it without a confirmation dialog

#### Scenario: Selection after success or refresh

- **WHEN** a start succeeds, the list refreshes, or the rider switches tabs
- **THEN** started parcels and parcels no longer `at_office` leave the selection, and switching tabs clears it
