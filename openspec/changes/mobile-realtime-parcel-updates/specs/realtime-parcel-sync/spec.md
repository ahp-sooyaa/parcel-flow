## ADDED Requirements

### Requirement: Parcel streams share one connection budget

The system SHALL serve the web parcel stream and the mobile rider parcel events stream through one shared stream helper, with one global limit on open streams across both.

#### Scenario: Web stream behaviour is unchanged

- **WHEN** a web dashboard opens `/api/realtime/parcels` for any surface
- **THEN** it receives the same `ready`, `parcel-upsert`, `parcel-remove`, `stats-invalidated` and `stream-error` events as before, with the same per-IP limit of 4 streams

#### Scenario: Global limit covers both streams

- **WHEN** the combined number of open web and mobile parcel streams reaches the global limit
- **THEN** a new request to either stream receives HTTP 204 until a stream closes

#### Scenario: Mobile streams are limited per rider

- **WHEN** several riders connect from one client IP
- **THEN** the mobile stream limits each rider's own open streams instead of applying the web per-IP limit
