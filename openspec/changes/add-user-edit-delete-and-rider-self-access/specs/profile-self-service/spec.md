## ADDED Requirements

### Requirement: Users can update their own shared profile fields from the profile page
The system SHALL keep `/dashboard/profile` as the self-service page for shared identity data. The profile workflow MUST allow the authenticated user to update only their own allowed shared fields, MUST validate input on the server, and MUST NOT trust any client-supplied ownership value.

#### Scenario: User updates own shared profile data
- **WHEN** an authenticated user submits valid self-profile data on `/dashboard/profile`
- **THEN** the system SHALL update that user’s own shared profile record and refresh the profile page

#### Scenario: Profile page rejects invalid self-profile data
- **WHEN** an authenticated user submits invalid self-profile input
- **THEN** the system SHALL reject the mutation without changing stored profile data

### Requirement: Profile page exposes role-aware navigation to role-specific profile maintenance
The system SHALL present role-aware navigation from `/dashboard/profile` when a user has additional merchant or rider profile data maintained elsewhere. Merchant users MUST be able to reach their merchant profile maintenance flow from the profile area, and rider users MUST be able to reach their rider profile maintenance flow from the profile area.

#### Scenario: Merchant profile page exposes merchant profile maintenance
- **WHEN** the authenticated user has the `merchant` role and an owned merchant profile
- **THEN** `/dashboard/profile` SHALL display a navigation path to that user’s merchant detail or edit workflow

#### Scenario: Rider profile page exposes rider profile maintenance
- **WHEN** the authenticated user has the `rider` role and an owned rider profile
- **THEN** `/dashboard/profile` SHALL display a navigation path to that user’s rider detail or edit workflow
