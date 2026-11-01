## ADDED Requirements

### Requirement: Rider parcel events API

The system SHALL provide `GET /api/mobile/v1/rider/parcels/events`, a `text/event-stream` that tells the signed-in rider which of their parcels changed, without sending parcel data.

#### Scenario: Rider opens the stream

- **WHEN** an active rider requests the stream
- **THEN** the system responds with HTTP 200 and `Content-Type: text/event-stream`, sends a `ready` event once subscribed, and sends a keepalive comment at least every 20 seconds

#### Scenario: Rider's parcel changes

- **WHEN** a parcel assigned to the rider is created, updated or deleted, including by an admin
- **THEN** the stream sends a `parcel-changed` event with `{ parcelId }` and no other parcel fields

#### Scenario: Parcel reassigned away from the rider

- **WHEN** a parcel assigned to the rider is reassigned to another rider or unassigned
- **THEN** the stream still sends `parcel-changed` for that parcel

#### Scenario: Another rider's parcel changes

- **WHEN** a parcel that is not and was not assigned to the rider changes
- **THEN** the stream sends nothing for it

#### Scenario: Not signed in or not a rider

- **WHEN** the request has no session, or the user is inactive or not a rider
- **THEN** the system responds with HTTP 401 or 403 and a JSON `{ ok: false, message }` body, and opens no stream

#### Scenario: Connection limits

- **WHEN** the rider already has 2 open streams, or the server's shared stream budget is used up
- **THEN** the system responds with HTTP 204 and opens no stream
- **AND** riders who share one client IP can each still open their own streams

#### Scenario: Stream closes cleanly

- **WHEN** the client disconnects or the realtime channel closes
- **THEN** the system releases the stream's slot and its realtime channel

### Requirement: Live parcel updates in the mobile app

The mobile app SHALL keep the rider's parcel list and detail screens up to date while the app is in the foreground, using the parcel events stream.

#### Scenario: Change shows without a refresh

- **WHEN** an admin assigns, reassigns, resolves or corrects one of the rider's parcels while the app is open
- **THEN** within a few seconds the app refetches the parcel lists, tab counts and that parcel's detail, without the rider refreshing

#### Scenario: Bursts are batched

- **WHEN** several of the rider's parcels change within one second
- **THEN** the app refetches the lists once, and each changed parcel's detail once

#### Scenario: App in the background

- **WHEN** the app goes to the background
- **THEN** the app closes the stream, and reopens it when the app returns to the foreground

#### Scenario: Connection drops

- **WHEN** the stream ends, errors, or sends nothing for 50 seconds
- **THEN** the app reconnects with increasing delays up to 30 seconds, and refetches the lists once reconnected

#### Scenario: Server at capacity

- **WHEN** the stream request returns HTTP 204
- **THEN** the app keeps working with its existing refetches and tries the stream again after 60 seconds

#### Scenario: Session ends

- **WHEN** the stream request returns HTTP 401
- **THEN** the app signs the rider out, as for any other API request
