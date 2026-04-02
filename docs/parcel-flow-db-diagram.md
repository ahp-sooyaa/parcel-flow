# Parcel Flow — Database Diagram Reference

This document is meant to live in the repo as an implementation reference and as stable context for Codex.

## Scope

This diagram covers the **whole current project structure**, not only rider and township.

That said, it is intentionally still **MVP-shaped**:

- it includes the core domains we already know we need
- it supports the current implementation step of **rider list/create** and **township CRUD**
- it also keeps the broader project direction visible so new work does not drift

So for your current step, you will mostly touch:

- `riders`
- `townships`
- `users`
- permissions / RBAC tables

But the reference also includes:

- `merchants`
- `parcels`
- settlement tables
- township delivery fee configuration
- parcel status history

---

## Current Decisions Reflected Here

- `users` is the application account table
- `merchants` is a **separate domain table**
- `users` ↔ `merchants` is **one-to-one**
- `riders` is a separate domain table linked one-to-one with a user account
- password change is **not permission-gated**
- RBAC permissions are only for business resources and admin actions
- `townships` is a master/config table and can appear in sidebar navigation for now
- delivery fees should be configurable by township rather than hardcoded into parcel logic

---

## Mermaid ER Diagram

```mermaid
erDiagram
    users {
        uuid id PK
        string full_name
        string email UK
        string phone_number_nullable
        uuid role_id FK
        boolean is_active
        boolean must_reset_password
        timestamp created_at
        timestamp updated_at
    }

    roles {
        uuid id PK
        string slug UK
        string name
        text description_nullable
        timestamp created_at
        timestamp updated_at
    }

    permissions {
        uuid id PK
        string slug UK
        string name
        text description_nullable
        timestamp created_at
        timestamp updated_at
    }

    role_permissions {
        uuid role_id FK
        uuid permission_id FK
        timestamp created_at
    }

    merchants {
        uuid id PK
        uuid user_id FK UK
        string shop_name
        string contact_name_nullable
        string contact_phone_nullable
        uuid township_id_nullable FK
        text address_nullable
        boolean is_active
        text note_nullable
        timestamp created_at
        timestamp updated_at
    }

    riders {
        uuid id PK
        uuid user_id FK UK
        string rider_code_nullable UK
        string contact_phone_nullable
        uuid township_id_nullable FK
        boolean is_active
        text note_nullable
        timestamp created_at
        timestamp updated_at
    }

    townships {
        uuid id PK
        string code UK
        string name UK
        boolean is_active
        integer sort_order
        text notes_nullable
        timestamp created_at
        timestamp updated_at
    }

    township_delivery_fees {
        uuid id PK
        uuid township_id FK
        decimal base_fee_mmk
        decimal base_weight_kg
        decimal extra_fee_per_kg_mmk
        decimal max_weight_kg
        boolean is_active
        date effective_from_nullable
        date effective_to_nullable
        timestamp created_at
        timestamp updated_at
    }

    parcels {
        uuid id PK
        string parcel_code UK
        uuid merchant_id FK
        uuid assigned_rider_id_nullable FK
        uuid sender_township_id FK
        uuid receiver_township_id FK
        string sender_name
        string sender_phone
        text sender_address
        string receiver_name
        string receiver_phone
        text receiver_address
        text item_description_nullable
        decimal item_value_mmk_nullable
        boolean is_cod
        decimal cod_amount_mmk
        decimal delivery_fee_mmk
        string delivery_fee_payer
        boolean collect_delivery_fee_at_pickup
        string payment_method_nullable
        string payment_status
        string parcel_status
        decimal actual_weight_kg_nullable
        decimal width_cm_nullable
        decimal height_cm_nullable
        decimal length_cm_nullable
        decimal volumetric_weight_kg_nullable
        decimal chargeable_weight_kg_nullable
        timestamp pickup_requested_at_nullable
        timestamp picked_up_at_nullable
        timestamp delivered_at_nullable
        timestamp failed_at_nullable
        text internal_note_nullable
        text delivery_note_nullable
        timestamp created_at
        timestamp updated_at
    }

    parcel_status_histories {
        uuid id PK
        uuid parcel_id FK
        string from_status_nullable
        string to_status
        uuid changed_by_user_id_nullable FK
        text note_nullable
        timestamp created_at
    }

    merchant_settlements {
        uuid id PK
        uuid merchant_id FK
        string settlement_code UK
        date period_start_nullable
        date period_end_nullable
        decimal total_cod_collected_mmk
        decimal total_delivery_fee_deducted_mmk
        decimal total_adjustment_mmk
        decimal total_amount_payable_mmk
        string settlement_status
        timestamp settled_at_nullable
        uuid settled_by_user_id_nullable FK
        text note_nullable
        timestamp created_at
        timestamp updated_at
    }

    merchant_settlement_items {
        uuid id PK
        uuid settlement_id FK
        uuid parcel_id FK
        decimal cod_amount_mmk
        decimal delivery_fee_mmk
        decimal adjustment_mmk
        decimal net_amount_mmk
        timestamp created_at
    }

    roles ||--o{ users : assigned_to

    roles ||--o{ role_permissions : has
    permissions ||--o{ role_permissions : grants

    users ||--|| merchants : merchant_profile
    users ||--|| riders : rider_profile

    townships ||--o{ merchants : located_in
    townships ||--o{ riders : based_in

    townships ||--o{ township_delivery_fees : has

    merchants ||--o{ parcels : creates
    riders ||--o{ parcels : assigned_to

    townships ||--o{ parcels : sender_township
    townships ||--o{ parcels : receiver_township

    parcels ||--o{ parcel_status_histories : has
    users ||--o{ parcel_status_histories : changes

    merchants ||--o{ merchant_settlements : receives
    users ||--o{ merchant_settlements : settles

    merchant_settlements ||--o{ merchant_settlement_items : contains
    parcels ||--o| merchant_settlement_items : included_in
```

---

## Domain Notes

### Users

`users` is the authenticated application account.

It should contain only account-level concerns such as:

- identity
- role
- active/inactive status
- must-reset-password state

It should **not** absorb merchant business fields.

### Merchants

`merchants` is a separate business/domain table.

Use it for:

- shop name
- merchant contact details
- township and address
- merchant-specific notes
- future settlement/reporting needs

Current rule:

- one user account can link to at most one merchant
- one merchant belongs to exactly one user account in normal app logic

### Riders

`riders` is also a separate domain table linked one-to-one with `users`.

This keeps rider operational data separate from account/auth data.

### Townships

`townships` is the service-area master table.

For now it is reasonable to expose Townships directly in the sidebar instead of hiding it under Settings.

Later, when config grows, it can move into a Settings section.

### Township Delivery Fees

`township_delivery_fees` is separate from `townships` so pricing rules can evolve over time.

This allows:

- future fee changes without mutating history blindly
- effective date ranges if needed
- configurable startup rules such as max weight or extra fee per kg

### Parcels

`parcels` is the operational core.

Important ideas:

- keep COD and company fee values explicit
- do not mix settlement logic with ambiguous computed values
- keep fee payer explicit
- keep rider assignment nullable at creation time
- keep weight and dimensional fields auditable

### Settlements

Settlement tables are included because they are a real part of the intended merchant detail/payment flow, even if they are not being built right now.

---

## Permission Notes

Password change is **not** represented as a permission.

Reason:

- changing your own password is a normal authenticated account capability
- it does not need RBAC resource permission checks

Permissions should focus on actual business/admin resources, for example:

- `dashboard-page.view`
- `user-list.view`
- `user.view`
- `user.create`
- `user.update`
- `user.delete`
- `user-password.reset`
- `merchant-list.view`
- `merchant.view`
- `merchant.create`
- `merchant.update`
- `merchant.delete`
- `rider-list.view`
- `rider.view`
- `rider.create`
- `rider.update`
- `rider.delete`
- `parcel-list.view`
- `parcel.view`
- `parcel.create`
- `parcel.update`
- `parcel.delete`
- `township-list.view`
- `township.view`
- `township.create`
- `township.update`
- `township.delete`

---

## Implementation Guidance for the Current Step

For the immediate work on rider and township, this document implies:

### Rider list/create

Need at minimum:

- `users`
- `riders`
- role / permission checks
- one-to-one user linkage

Suggested rider fields for v1:

- linked user
- contact phone
- township
- active status
- note

### Township CRUD

Need at minimum:

- unique township name
- optional unique code
- active flag
- sort order
- notes

Even if delivery fee CRUD is not built yet, township design should already anticipate:

- parcel sender/receiver selection
- rider or merchant township linkage
- future pricing records

---

## Suggested Repo Note for Codex / AGENTS

Use wording close to this:

> Parcel Flow keeps `users` as the auth/account table. `merchants` and `riders` are separate domain tables linked one-to-one with `users`. Password change is not permission-gated. RBAC permissions apply only to business/admin resources. `townships` is currently a first-class sidebar resource and will later move under Settings if configuration grows.
