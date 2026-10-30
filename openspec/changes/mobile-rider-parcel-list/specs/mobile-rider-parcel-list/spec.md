## ADDED Requirements

### Requirement: Rider parcel list API

The system SHALL provide `GET /api/mobile/v1/rider/parcels`, which returns one page of the signed-in rider's assigned parcels for a tab, plus the parcel count of every tab.

#### Scenario: Rider loads a tab

- **WHEN** an active rider requests `tab=to_deliver&page=1`
- **THEN** the response contains only parcels assigned to that rider whose status is `at_office`, `on_the_way`, or `canceled_returned`, newest first, with `page`, `totalPages`, `totalCount`, and counts for the `to_deliver`, `delivered`, and `returned` tabs

#### Scenario: Default tab and page

- **WHEN** an active rider requests the list without `tab` or `page`
- **THEN** the system returns page 1 of the `to_deliver` tab

#### Scenario: Invalid query

- **WHEN** the request has an unknown `tab` or a `page` that is not a positive integer
- **THEN** the system responds with HTTP 400 and `{ ok: false, message }`

#### Scenario: Another rider's parcels are excluded

- **WHEN** a rider loads any tab
- **THEN** no parcel assigned to a different rider, or to no rider, appears in the results or the counts

#### Scenario: List item fields

- **WHEN** the list returns a parcel
- **THEN** it includes the parcel id, code, status, status label, receiver name, phone, address, township, whether it has an active failure note, and the amount to collect (COD amount plus delivery fee), and it does not include proof image keys, correction data, or other riders' details

### Requirement: Rider parcel detail API

The system SHALL provide `GET /api/mobile/v1/rider/parcels/{parcelId}`, which returns one parcel's details only when it is assigned to the signed-in rider.

#### Scenario: Rider opens an assigned parcel

- **WHEN** an active rider requests a parcel assigned to them
- **THEN** the system responds with HTTP 200 and the list item fields plus merchant name, parcel type, COD amount, delivery fee, weight, special notes, the active failure note, and the created time

#### Scenario: Parcel not assigned to the rider

- **WHEN** a rider requests a parcel that does not exist, is deleted, or is assigned to someone else
- **THEN** the system responds with HTTP 404 and the same "Parcel not found." message in every case

#### Scenario: Invalid parcel id

- **WHEN** the parcel id is not a UUID
- **THEN** the system responds with HTTP 400

### Requirement: Rider parcel list in the mobile app

The mobile app SHALL show the signed-in rider's parcels as the home screen, grouped into To deliver, Delivered, and Returned tabs.

#### Scenario: Rider opens the app

- **WHEN** a signed-in rider opens the app
- **THEN** the app shows the To deliver tab with parcel cards and the count on each tab

#### Scenario: Parcel card content

- **WHEN** a parcel card is shown
- **THEN** it shows the parcel code, status label, receiver name, township, phone, address, and amount to collect in MMK

#### Scenario: Switching tabs

- **WHEN** the rider selects another tab
- **THEN** the app shows that tab's parcels

#### Scenario: Loading more parcels

- **WHEN** the rider scrolls to the end of a tab that has more pages
- **THEN** the app loads and appends the next page

#### Scenario: Pull to refresh

- **WHEN** the rider pulls down on the list
- **THEN** the app reloads the tab from the first page and updates the counts

#### Scenario: App returns to the foreground

- **WHEN** the app comes back to the foreground or the phone reconnects to the network
- **THEN** the visible parcel data is refetched

#### Scenario: Empty tab

- **WHEN** a tab has no parcels
- **THEN** the app shows an empty message for that tab instead of a blank list

#### Scenario: Load failure

- **WHEN** loading the list fails
- **THEN** the app shows the error message and a way to try again

### Requirement: Rider parcel detail in the mobile app

The mobile app SHALL show a parcel's details when the rider taps its card.

#### Scenario: Rider opens a parcel

- **WHEN** the rider taps a parcel card
- **THEN** the app opens the parcel detail screen with the receiver, address, township, merchant, parcel type, COD amount, delivery fee, amount to collect, weight, special notes, and any active failure note

#### Scenario: Call the receiver

- **WHEN** the rider taps the receiver's phone number on the detail screen
- **THEN** the phone's dialer opens with that number

#### Scenario: Parcel no longer assigned

- **WHEN** the detail request returns HTTP 404
- **THEN** the app shows that the parcel is no longer assigned to the rider and offers a way back to the list
