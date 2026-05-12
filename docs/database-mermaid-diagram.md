erDiagram
app_users {
uuid id PK
text name
text phone_number UK
text email
text role
boolean is_active
boolean must_reset_password
timestamp created_at
timestamp updated_at
timestamp deleted_at
}

merchants {
uuid id PK
uuid user_id FK
text shop_name
text address
timestamp created_at
timestamp updated_at
}

riders {
uuid id PK
uuid user_id FK
text name
integer age
text address
timestamp created_at
timestamp updated_at
}

townships {
uuid id PK
text name
integer base_fee
numeric base_weight_kg
integer extra_weight_fee
numeric extra_weight_unit_kg
integer volumetric_divisor
numeric cod_fee_percent
numeric return_fee_percent
boolean is_active
timestamp created_at
timestamp updated_at
}

rider_service_townships {
uuid id PK
uuid rider_id FK
uuid township_id FK
timestamp created_at
}

parcels {
uuid id PK
text parcel_code UK

    uuid merchant_id FK
    uuid rider_id FK
    uuid township_id FK

    text receiver_name
    text receiver_phone_number
    text receiver_address

    text parcel_type
    integer cod_amount
    integer delivery_fee

    numeric weight_kg
    numeric parcel_width_cm
    numeric parcel_height_cm
    numeric parcel_length_cm
    text special_notes

    text status

    integer collected_amount
    text cod_status
    text delivery_fee_status
    boolean is_received_by_office
    text merchant_settlement_status
    text rider_payout_status

    jsonb proof_of_delivery_images_keys
    jsonb pickup_images_keys

    uuid created_by FK
    uuid collection_confirmed_by FK

    timestamp assigned_at
    timestamp delivered_at
    timestamp returned_to_merchant_at
    timestamp collected_at
    timestamp created_at
    timestamp updated_at
    timestamp deleted_at

}

financial_items {
uuid id PK
uuid parcel_id FK
uuid merchant_id FK
uuid rider_id FK
uuid merchant_settlement_id FK
uuid rider_payout_id FK

    text item_type
    integer amount
    text status
    uuid created_by FK

    timestamp created_at
    timestamp updated_at
    timestamp settled_at

}

merchant_settlements {
uuid id PK
text settlement_code UK
uuid merchant_id FK
text status

    integer total_cod_amount
    integer total_delivery_fee_deduction
    integer net_payment_amount

    uuid bank_account_id FK
    uuid created_by FK
    uuid paid_by FK

    timestamp paid_at
    text payment_note

    timestamp created_at
    timestamp updated_at

}

rider_payouts {
uuid id PK
text payout_code UK
uuid rider_id FK
text status

    integer delivered_way_count
    integer fee_per_way
    integer total_payout_amount

    uuid bank_account_id FK
    uuid created_by FK
    uuid paid_by FK

    timestamp paid_at
    text payment_note

    timestamp created_at
    timestamp updated_at

}

bank_accounts {
uuid id PK
uuid user_id FK

    text bank_name
    text account_holder_name
    text account_number
    boolean is_company_account
    boolean is_primary

    timestamp created_at
    timestamp updated_at
    timestamp deleted_at

}

parcel_status_logs {
uuid id PK
uuid parcel_id FK
text old_status
text new_status
uuid changed_by FK

    timestamp created_at

}

app_users ||--o| merchants : "has merchant profile"
app_users ||--o| riders : "has rider profile"

merchants ||--o{ parcels : "owns"
riders ||--o{ parcels : "assigned"
townships ||--o{ parcels : "delivery township"

riders ||--o{ rider_service_townships : "serves"
townships ||--o{ rider_service_townships : "covered by"

parcels ||--o{ financial_items : "generates"
merchants ||--o{ financial_items : "has settlement items"
riders ||--o{ financial_items : "has payout items"

merchants ||--o{ merchant_settlements : "has settlements"
merchant_settlements ||--o{ financial_items : "settles"

riders ||--o{ rider_payouts : "has payouts"
rider_payouts ||--o{ financial_items : "pays rider ways"

parcels ||--o{ parcel_status_logs : "status history"
app_users ||--o{ parcel_status_logs : "changed by"

app_users ||--o{ parcels : "created by"
app_users ||--o{ parcels : "confirmed collection by"
app_users ||--o{ financial_items : "created by"
app_users ||--o{ bank_accounts : "owns"

app_users ||--o{ merchant_settlements : "created by"
app_users ||--o{ merchant_settlements : "paid by"

app_users ||--o{ rider_payouts : "created by"
app_users ||--o{ rider_payouts : "paid by"
