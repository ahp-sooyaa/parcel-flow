## ADDED Requirements

### Requirement: Merchant profiles can be edited from dedicated merchant routes
The system SHALL provide a merchant profile edit workflow at `/dashboard/merchants/[id]/edit`. The workflow MUST load merchant business-profile fields from merchant feature DAL functions, MUST validate updates on the server, and MUST keep shared identity fields separate from merchant-only fields.

#### Scenario: Admin edits merchant profile from dedicated route
- **WHEN** a super admin or office admin with `merchant.update` opens `/dashboard/merchants/[id]/edit` for an existing merchant user
- **THEN** the system SHALL load the merchant edit form with the current merchant profile values

#### Scenario: Merchant user edits owned merchant profile
- **WHEN** an authenticated merchant opens `/dashboard/merchants/[id]/edit` for their own merchant record
- **THEN** the system SHALL allow access to the edit workflow and persist valid merchant-only updates

#### Scenario: Merchant user cannot edit another merchant profile
- **WHEN** a merchant user opens `/dashboard/merchants/[id]/edit` for a merchant record they do not own
- **THEN** the system SHALL deny access to that route

### Requirement: Merchant detail views expose the edit entry point only when authorized
The system SHALL expose merchant profile edit entry points from merchant detail and user-management flows only to authorized actors. Unauthorized users MUST NOT receive edit controls or successful mutation paths.

#### Scenario: Admin sees merchant edit entry point
- **WHEN** a super admin or office admin can access a merchant detail page
- **THEN** the system SHALL display a path to the merchant edit workflow

#### Scenario: Merchant owner sees self edit entry point
- **WHEN** a merchant user can access their own merchant detail page
- **THEN** the system SHALL display a path to the merchant edit workflow for that same merchant record
