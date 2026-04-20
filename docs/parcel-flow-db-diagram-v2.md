# Parcel Flow Database Diagram (v3)

Updated decisions:

- `app_users` stores shared human/account fields
- `merchants` stores business profile fields only
- `riders` stores rider operational fields only
- superadmin create user, merchant and rider records will auto create. for merchant shop name, we will use app_user name as default. For rider, we will use bike as default for vehicle type. Other fields will be null.
- No more seperate create form for merchant and rider. We will use user create form to create both. When select role in user create form, it will show merchant or rider fields.

## Mermaid ER Diagram

```mermaid
erDiagram
    %% Identity & Profiles
    app_users ||--|| merchants : "profile"
    app_users ||--|| rider : "profile"
    app_users ||--o{ bank_account : "owns"

    %% Infrastructure & Geography
    townships ||--o{ merchants : "pickup_township"
    townships ||--o{ parcels : "recipient_township"
    townships ||--o{ delivery_fee_rate : "pricing"
    townships ||--o{ rider_service_townships : "covered_by"
    rider ||--o{ rider_service_townships : "assigned_to"

    %% Core Logistics
    merchants ||--o{ parcels : "sends"
    rider ||--o{ parcels : "delivers"
    parcels ||--o{ parcel_audit_log : "history"

    %% Financial Hub
    parcels ||--|| parcel_payment_records : "1:1 ledger"

    %% Payouts & Settlements (Linked via Payment Record)
    parcel_payment_records ||--o{ rider_payout_item : "payout_link"
    parcel_payment_records ||--o{ merchant_settlement_item : "settlement_link"

    rider_payout ||--o{ rider_payout_item : "contains"
    merchant_settlement ||--o{ merchant_settlement_item : "contains"

    bank_account ||--o{ rider_payout : "target_account"
    bank_account ||--o{ merchant_settlement : "target_account"

    app_users {
        uuid supabase_user_id PK
        string full_name
        string email
        string phone
        int role_id
        boolean must_reset_password
        boolean is_active
        timestamp deleted_at
        timestamp created_at
        timestamp updated_at
    }

    merchants {
        uuid app_user_id PK, FK
        string shop_name
        uuid pickup_township_id FK
        string default_pickup_address
        text notes
        timestamp deleted_at
        timestamp created_at
        timestamp updated_at
    }

    rider {
        uuid app_user_id PK, FK
        string vehicle_type
        string license_plate
        boolean is_active
        timestamp deleted_at
        timestamp created_at
        timestamp updated_at
    }

    parcels {
        uuid id PK
        string parcel_code
        uuid merchant_id FK
        uuid rider_id FK "Nullable"
        string recipient_name
        string recipient_phone
        uuid recipient_township_id FK
        text recipient_address
        text parcel_description
        int package_count
        text special_handling_note
        decimal estimated_weight_kg
        decimal package_width_cm
        decimal package_height_cm
        decimal package_length_cm
        decimal cod_amount
        decimal delivery_fee
        string delivery_fee_payer "merchant | receiver"
        string type "cod | non-cod"
        decimal total_amount_to_collect
        string status "pending | out_for_pickup | at_office | out_for_delivery | delivered | return_to_office | return_to_merchant | returned | cancelled"
        jsonb pickup_image_keys
        jsonb proof_of_delivery_image_keys
        timestamp created_at
        timestamp updated_at
    }

    parcel_payment_records {
        uuid id PK
        uuid parcel_id FK
        string delivery_fee_status "unpaid | paid_by_merchant | collected_from_receiver | deduct_from_settlement | bill_merchant | waived"
        string cod_fee_status "not_applicable | pending | collected | not_collected"
        decimal collected_amount
        string collection_status "pending | not_collected | collected_by_rider | received_by_office | void"
        string merchant_settlement_status "pending | in_progress | settled"
        string rider_payout_status "pending | in_progress | paid"
        text note
        jsonb payment_slip_image_keys
        timestamp created_at
        timestamp updated_at
    }

    parcel_audit_log {
        uuid id PK
        uuid parcel_id FK
        uuid updated_by FK
        string event "e.g. update_parcel_status"
        jsonb old_values
        jsonb new_values
        timestamp created_at
    }

    rider_payout {
        uuid id PK
        string reference_no
        uuid rider_id FK
        uuid bank_account_id FK
        decimal total_amount
        string method
        string snapshot_bank_name
        string snapshot_account_no
        uuid created_by_user_id FK
        string receipt_url
        text note
        string status "pending | in_progress | paid | cancelled | rejected"
        jsonb payment_slip_url
        timestamp created_at
        timestamp updated_at
    }

    rider_payout_item {
        uuid id PK
        uuid rider_payout_id FK
        uuid parcel_payment_record_id FK
        decimal snapshot_delivery_fee
        decimal payout_amount
        timestamp created_at
        timestamp updated_at
    }

    merchant_settlement {
        uuid id PK
        string reference_no
        uuid merchant_id FK
        uuid bank_account_id FK
        decimal total_amount
        string method
        string snapshot_bank_name
        string snapshot_bank_account_number
        uuid created_by FK
        uuid confirmed_by FK
        string receipt_url
        text note
        string type "invoice | remit"
        string status "pending | in_progress | paid | cancelled | rejected"
        jsonb payment_slip_url
        timestamp created_at
        timestamp updated_at
    }

    merchant_settlement_item {
        uuid id PK
        uuid merchant_settlement_id FK
        uuid parcel_payment_record_id FK
        decimal snapshot_cod_amount
        decimal snapshot_delivery_fee
        boolean is_delivery_fee_deducted
        decimal net_payable_amount
        timestamp created_at
        timestamp updated_at
    }

    townships {
        uuid id PK
        string name
        boolean is_active
        timestamp deleted_at
        timestamp created_at
        timestamp updated_at
    }

    delivery_fee_rate {
        uuid id PK
        uuid township_id FK
        decimal base_fee
        decimal base_weight_kg
        decimal extra_fee_per_kg
        decimal max_weight_kg
        decimal volumetric_divisor
        boolean is_active
        datetime effective_from
        datetime effective_to
        timestamp deleted_at
        timestamp created_at
        timestamp updated_at
    }

    bank_account {
        uuid id PK
        uuid app_user_id FK
        string bank_name
        string bank_account_name
        string bank_account_number
        boolean is_company_account
        timestamp deleted_at
        timestamp created_at
        timestamp updated_at
    }

    rider_service_townships {
        uuid id PK
        uuid rider_id FK
        uuid township_id FK
        timestamp deleted_at
        timestamp created_at
        timestamp updated_at
    }
```
