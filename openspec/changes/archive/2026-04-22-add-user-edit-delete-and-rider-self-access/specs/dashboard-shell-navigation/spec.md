## ADDED Requirements

### Requirement: Dashboard shell provides self-navigation for merchant and rider users
The system SHALL build dashboard sidebar navigation on the server and SHALL expose self-navigation links for merchant and rider users when the current session resolves an owned merchant or rider profile. Admin list navigation MUST remain permission-driven.

#### Scenario: Merchant user sees self merchant navigation
- **WHEN** the current user has role `merchant` and the server resolves the owned merchant profile identifier
- **THEN** the dashboard shell SHALL show a self-navigation item to that merchant detail route instead of the admin merchant list link

#### Scenario: Rider user sees self rider navigation
- **WHEN** the current user has role `rider` and the server resolves the owned rider profile identifier
- **THEN** the dashboard shell SHALL show a self-navigation item to that rider detail route instead of requiring the rider user to navigate only through parcels

#### Scenario: Admin navigation remains permission-driven
- **WHEN** the current user has list permissions for merchants or riders
- **THEN** the dashboard shell SHALL show the corresponding list navigation items regardless of self-service link behavior for merchant or rider users
