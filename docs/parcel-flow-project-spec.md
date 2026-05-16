# Parcel Flow — Project Specification

## 1. Project Overview

**Parcel Flow** is an internal delivery management system for managing parcels after they arrive at the office.

The system starts after pickup is completed outside the app. Pickup requests are currently accepted through Telegram, and Parcel Flow begins when parcels arrive at the office.

The app is used by admins, merchants, and riders to manage parcel records, rider assignments, delivery status, COD collection, delivery fee handling, merchant settlements, and rider payouts.

---

## 2. Core Scope

Parcel Flow MVP includes:

- Admin-created user accounts
- Username and password login
- No public signup
- No phone verification
- Four user roles
- Parcel creation by admin
- Merchant parcel visibility
- Rider parcel assignment
- Rider parcel listing
- Parcel status tracking
- Delivery fee calculation
- COD and delivery fee collection tracking
- Rider expected and actual collection tracking
- Financial item generation for merchant settlement
- Merchant settlement draft creation
- Super admin payment confirmation
- Rider payout by delivered way count
- Merchant received payment view

---

## 3. Authentication and Account Management

### 3.1 Login Method

Users sign in with:

- **Username**
- **Password**

The system does not support:

- Public signup
- OTP login
- Phone verification
- Public forgot-password flow

---

### 3.2 User Account Creation

User accounts are created manually by an admin.

Required behavior:

- Admin creates the account.
- Admin enters the user's name, phone number, address, optional age, role, and role-specific profile details.
- System generates a unique username from the user's name.
- System stores an internal email generated from the username for Better Auth compatibility.
- Phone number, address, and age are stored as Better Auth user additional/custom fields.
- The generated internal email is not used as a user-facing login field.
- Admin assigns the role.
- Admin gives credentials to the user outside the system.
- Admin can generate an initial password.
- Admin can regenerate password when a user forgets the password.
- User can change password after login.
- User may be forced to change password after admin password regeneration.

---

### 3.3 Password Regeneration

Both **super admin** and **office admin** can regenerate user passwords.

Rules:

- Office admin can regenerate passwords for normal users.
- Office admin must not regenerate password for super admin accounts.
- Regenerated password should be temporary.
- User should be required to change password after signing in with regenerated password.

---

## 4. User Roles

The system has four roles:

1. **Super Admin**
2. **Office Admin**
3. **Merchant**
4. **Rider**

---

### 4.1 Super Admin

Super admin has full system access.

Can:

- Manage users
- Manage merchants
- Manage riders
- Manage office admins
- Create parcels
- Edit parcels
- Assign parcels to riders
- Update parcel statuses
- Edit delivery fee before rider assignment
- Manage delivery pricing
- Manage bank accounts
- Create settlement drafts
- Mark settlements as paid
- Cancel settlements
- Create rider payout drafts
- Mark rider payouts as paid
- Regenerate user passwords
- View reports and stats

---

### 4.2 Office Admin

Office admin handles daily operations.

Can:

- Create parcels
- Edit normal parcel information
- Assign parcels to riders
- Update operational parcel statuses
- View merchants
- View riders
- View parcel lists
- Track rider collection amounts
- Create merchant settlement drafts
- Create rider payout drafts
- Regenerate user passwords, except super admin accounts

Cannot:

- Edit delivery fee manually
- Create or edit bank accounts
- Create or edit delivery pricing / township settings
- Mark merchant settlements as paid
- Mark rider payouts as paid
- Cancel merchant settlements
- Cancel rider payouts
- Manage super admin accounts
- Confirm actual bank transfer

---

### 4.3 Merchant

Merchant can only view their own business data.

Can:

- View own parcels
- Search own parcels by receiver phone number
- Filter own parcels by date
- View payment / settlement status
- View received payment stats
- View bank account information
- Edit limited personal account details
- Change own password

Cannot:

- Create parcels
- Edit parcels
- Delete parcels
- Assign riders
- Update parcel status
- Edit bank accounts

---

### 4.4 Rider

Rider handles delivery for assigned parcels.

Can:

- View assigned parcels
- Search assigned parcels by customer phone number
- Filter assigned parcels by status
- View expected collection amount
- View actual collected amount
- Start delivery for assigned parcels
- Mark assigned parcel as delivered
- View own bank account information
- Edit limited personal account details
- Change own password

Cannot:

- Create parcels
- Edit parcel details
- Assign parcels
- View unrelated parcels
- Mark parcel as postponed
- Mark parcel as canceled / returned
- Mark parcel as returned to merchant
- Edit bank accounts

---

## 5. User Settings

User settings contains two tabs:

1. **Account Details**
2. **Bank Accounts**

---

### 5.1 Account Details

Users can view and edit limited personal account information.

Editable by user:

- Name
- Address
- Password
- Some personal contact information, depending on business rule

Not editable by user:

- Role
- Permissions
- Account active status
- Bank account information

---

### 5.2 Bank Accounts

Users can view bank account information but cannot edit it.

Bank accounts are managed by super admin only.

Rules:

- Bank accounts are linked to the Better Auth user model.
- The application does not maintain a separate `app_users` domain table.
- Parcel Flow user fields such as username, phone number, address, age, role, active status, and password reset requirement belong on the Better Auth user model as configured application-specific fields.
- Merchant users can have multiple bank accounts.
- Rider users can have multiple bank accounts.
- Company bank accounts can be stored with `is_company_account = true`.
- One account can be marked as primary.
- Users cannot add, edit, or delete bank accounts from their own settings.
- Office admin, merchant, and rider users cannot create, edit, or delete bank accounts.

Recommended display format:

```text
KBZ Bank - Account Holder Name - ******123456
```

---

## 6. Parcel Creation Flow

Parcel Flow starts when parcels arrive at the office.

External process before app:

1. Merchant sends pickup request through Telegram.
2. Office accepts pickup request.
3. Rider picks up parcel from merchant.
4. Parcel arrives at office.
5. Admin creates parcel in Parcel Flow.

---

### 6.1 Parcel Creation Steps

1. Super admin or office admin opens **Create Parcel** page.
2. Admin selects merchant.
3. Admin enters receiver information.
4. Admin selects township.
5. System auto-fills delivery fee from delivery pricing.
6. Admin enters COD amount if parcel is COD type.
7. Admin saves parcel.
8. Parcel is created with status **At Office**.
9. Merchant can now see the parcel in **My Parcels**.
10. Rider can see the parcel only after assignment.

---

### 6.2 Parcel Form Fields

Parcel creation form should include:

- Merchant
- Receiver / customer name
- Receiver phone number
- Receiver address
- Township
- Parcel type
- COD amount, required only for COD parcel
- Delivery fee, auto-filled from delivery pricing
- Special notes
- Weight, default 3kg
- Large parcel flag
- Width, height, and length if large parcel
- Pickup images, optional

Default parcel status:

```text
at_office
```

---

## 7. Parcel Code

Parcel code format:

```text
PF-XXXXXX-XXXXXX
```

Example:

```text
PF-483921-740268
```

Rules:

- Both parts are random 6-digit numbers.
- Code must be unique.
- Database must enforce uniqueness.
- If generated code already exists, system should retry generation.
- Parcel code should be readable and usable for search, support, and communication.

Recommended retry behavior:

- Retry code generation up to 5 times.
- If still duplicated, return system error.

---

## 8. Parcel Statuses

The system uses these parcel statuses:

| Status | Display Label | Meaning |
|---|---|---|
| `at_office` | At Office | Parcel is still at office and not yet out for delivery; it may be unassigned or already assigned to a rider |
| `on_the_way` | On The Way | Rider has started delivery and parcel is out for delivery |
| `delivered` | Delivered | Parcel was delivered successfully |
| `postpone` | Postpone | Delivery is postponed and needs another delivery action |
| `canceled_returned` | Canceled / Returned | Delivery failed and needs return process |
| `returned_to_merchant` | Returned to Merchant | Parcel has been physically returned to merchant |

---

## 9. Parcel Payment Statuses

Payment status fields are stored directly on `parcels` for MVP simplicity.

### 9.1 COD Status

Allowed values:

```text
pending
not_applicable
collected
not_collected
```

Meaning:

| Status | Meaning |
|---|---|
| `pending` | COD parcel is active and COD collection is still pending |
| `not_applicable` | Non-COD parcel |
| `collected` | COD was collected from receiver |
| `not_collected` | COD was not collected |

---

### 9.2 Delivery Fee Status

Allowed values:

```text
pending
collected
not_collected
deduct_from_merchant
waived
```

Meaning:

| Status | Meaning |
|---|---|
| `pending` | Delivery fee collection is still pending |
| `collected` | Delivery fee was collected from receiver |
| `not_collected` | Delivery fee was not collected |
| `deduct_from_merchant` | Delivery fee will be deducted from merchant settlement |
| `waived` | Delivery fee is waived by business decision |

---

### 9.3 Office Collection Confirmation

The final database uses `is_received_by_office` on parcels.

Field type:

```text
boolean
```

Meaning:

- `false` = office has not yet confirmed receiving money from rider
- `true` = office confirmed receiving money from rider

Related rule:

- Rider collection still becomes effective when parcel is delivered.
- `collection_confirmed_by` stores which admin confirmed office receipt when `is_received_by_office = true`.

---

### 9.4 Merchant Settlement Status

Allowed values:

```text
pending
in_progress
settled
```

Meaning:

| Status | Meaning |
|---|---|
| `pending` | Not yet included in paid settlement |
| `in_progress` | Included in draft settlement |
| `settled` | Settlement was paid |

---

### 9.5 Rider Payout Status

Allowed values:

```text
pending
in_progress
settled
```

Meaning:

| Status | Meaning |
|---|---|
| `pending` | Not yet included in rider payout |
| `in_progress` | Included in draft rider payout |
| `settled` | Rider payout was paid |

---

## 10. Parcel Status Flows

Assignment alone does not change parcel status to `on_the_way`.
The `at_office -> on_the_way` transition happens when the rider starts delivery.

### 10.1 Successful Delivery Flow

```text
at_office -> on_the_way -> delivered
```

---

### 10.2 Failed Return Flow

```text
at_office -> on_the_way -> canceled_returned -> returned_to_merchant
```

---

### 10.3 Postponed Then Delivered Flow

```text
at_office -> on_the_way -> postpone -> on_the_way -> delivered
```

---

### 10.4 Postponed Then Returned Flow

```text
at_office -> on_the_way -> postpone -> canceled_returned -> returned_to_merchant
```

---

## 11. Status Update Permissions

| Status Change | Allowed Role |
|---|---|
| `at_office -> on_the_way` | Rider when starting delivery |
| `on_the_way -> delivered` | Rider or admin |
| `on_the_way -> postpone` | Admin only |
| `on_the_way -> canceled_returned` | Admin only |
| `postpone -> on_the_way` | Admin only |
| `postpone -> canceled_returned` | Admin only |
| `canceled_returned -> returned_to_merchant` | Admin only |
| Manual correction | Super admin only |

Rider can only handle successful delivery progress by starting delivery and then marking parcel as delivered.

Rider should not directly update parcel to:

- Postpone
- Canceled / returned
- Returned to merchant
- At office

---

## 12. Status Change Side Effects

### 12.1 When Parcel Is Assigned

When admin assigns parcel to rider:

- `status` remains unchanged
- `assigned_at` is set
- `rider_id` is set
- Rider can see the parcel
- Rider expected collection amount updates if the parcel is active for rider collection

---

### 12.2 When Rider Starts Delivery

When rider starts delivery:

- `status = on_the_way`

---

### 12.3 When Parcel Is Delivered

When parcel becomes `delivered`:

For COD parcel:

- `cod_status = collected`
- `delivery_fee_status = collected`
- `is_received_by_office = false`
- `merchant_settlement_status = pending`
- `rider_payout_status = pending`
- `collected_amount = cod_amount + delivery_fee`
- Create settlement financial item:
  - `item_type = cod_remit`
  - `amount = cod_amount`
  - `status = pending`
- Create rider payout financial item:
  - `item_type = rider_way_payout`
  - `amount = 1`
  - `status = pending`

For non-COD parcel:

- `cod_status = not_applicable`
- `delivery_fee_status = collected`
- `is_received_by_office = false`
- `merchant_settlement_status` remains not relevant for COD remit
- `rider_payout_status = pending`
- `collected_amount = delivery_fee`
- No `cod_remit` financial item is created
- Create rider payout financial item:
  - `item_type = rider_way_payout`
  - `amount = 1`
  - `status = pending`

---

### 12.4 When Parcel Is Canceled / Returned

When admin changes parcel to `canceled_returned`:

- Delivery is considered failed
- Rider expected collection amount reduces immediately
- COD is not collected
- Delivery fee deduction is not created yet
- Parcel still needs physical return to merchant

Recommended updates:

- `cod_status = not_collected`
- `delivery_fee_status = not_collected`
- `is_received_by_office = false`
- `collected_amount = 0`
- Related financial items that are no longer valid should be marked `void`

---

### 12.5 When Parcel Is Returned to Merchant

When admin changes parcel to `returned_to_merchant`:

- Parcel is physically returned to merchant
- Delivery fee becomes deductible from merchant settlement
- Create settlement financial item:
  - `item_type = delivery_fee_deduction`
  - `amount = delivery_fee`
  - `status = pending`

Recommended updates:

- `delivery_fee_status = deduct_from_merchant`
- `merchant_settlement_status = pending`

---

## 13. Rider Assignment Flow

Admin assigns parcels to riders when a rider needs to deliver, retry, schedule, or return the parcel.

Assignment does not mean the rider has started delivery.
Assignment only links the parcel to a rider and sets assignment metadata.
It must not change the parcel status.

Allowed assignment statuses:

| Status | Assignment purpose |
|---|---|
| `at_office` | Parcel is at office and ready for delivery |
| `postpone` | Parcel needs scheduled delivery or retry delivery |
| `canceled_returned` | Parcel will not be retried and needs return handling back to merchant |

Not assignable through the normal bulk assignment flow:

| Status | Reason |
|---|---|
| `on_the_way` | Rider has already started delivery |
| `delivered` | Delivery is complete |
| `returned_to_merchant` | Return is complete |

Bulk assignment rules:

- Bulk assignment can be performed by super admin and office admin.
- Bulk assignment only applies to unassigned parcels.
- Assigned parcels should not be selectable in the bulk assignment UI.
- If assigned parcel IDs are submitted to the bulk assignment action, the server must reject them.
- Reassigning an already assigned parcel is handled from the edit parcel flow for now.
- Future bulk reassignment, bulk delete, and related batch operations are separate future features.

Steps:

1. Admin opens parcel listing page.
2. Admin filters parcels by township, status, and unassigned status.
3. Admin selects one or more unassigned eligible parcels.
4. Admin clicks **Assign Rider**.
5. Admin selects rider.
6. System displays selected parcel summary.
7. System displays total collection amount for selected delivery/retry parcels and selected return-ready parcel count.
8. Admin confirms assignment.
9. Parcel is assigned to rider, but its status remains unchanged.
10. Rider can now see assigned parcels.
11. Rider later changes eligible delivery parcels from **At Office** or **Postpone** to **On The Way** when starting delivery, once that status workflow is available.

---

### 13.1 Assignment Summary

Before confirming assignment, system should show:

```text
Selected parcels: 12
Total COD amount: 450,000 MMK
Total delivery fee: 24,000 MMK
Total expected collection: 474,000 MMK
Return-ready parcels: 2
Rider current expected collection today: 300,000 MMK
After assignment: 774,000 MMK
```

Expected collection should include selected `at_office` and `postpone` parcels.
Selected `canceled_returned` parcels are return work and should be counted separately from expected cash collection.

This helps admin avoid assigning too much cash collection or return workload to one rider.

---

## 14. Rider Module

### 14.1 Rider Profile Information

Rider profile should include:

- Name from linked user account
- Age from linked user account
- Phone number from linked user account
- Address from linked user account
- Service townships
- Active status from linked user account

`service_townships` means the townships where the rider is familiar or usually works.

Rules:

- One rider can have multiple service townships.
- One township can have multiple riders.

---

### 14.2 Rider Parcel Listing

Rider sees only assigned parcels.

Rider parcel listing columns:

| Column | Description |
|---|---|
| Parcel code | Unique parcel code |
| Customer name | Receiver name |
| Phone number | Receiver phone number |
| Address | Receiver address |
| Amount to collect | COD + delivery fee |
| Status | Current parcel status |

---

### 14.3 Rider Search and Filter

Rider should be able to search by:

- Customer phone number
- Parcel code

Rider should be able to filter by:

- Parcel status
- Date, optional

---

### 14.4 Rider Collection Tracking

The system tracks both:

- Expected collection amount
- Actual collected amount

Expected collection amount means money rider is expected to collect from active assigned parcels.

Actual collected amount means money rider has collected from delivered parcels.

Office confirmation is tracked by `is_received_by_office` and `collection_confirmed_by`.

---

### 14.5 Rider Expected Collection Amount

Expected collection amount includes parcels that are still active for collection.

Include statuses:

```text
at_office where rider is already assigned
on_the_way
postpone
```

Exclude statuses:

```text
delivered
canceled_returned
returned_to_merchant
```

When admin changes parcel status to `canceled_returned`, the rider expected collection amount should reduce immediately.

---

### 14.6 Rider Actual Collection Amount

When parcel is delivered:

For COD parcel:

```text
actual collected = COD amount + delivery fee
```

For non-COD parcel:

```text
actual collected = delivery fee
```

The value is stored in:

```text
parcels.collected_amount
```

---

## 15. Rider Payout

Rider payout is separate from merchant settlement.

Rider payout is based on **delivered way count**, and the eligible delivered ways are tracked through `financial_items`.

Example:

```text
Delivered ways: 40
Fee per way: 900 MMK
Total payout: 36,000 MMK
```

Formula:

```text
rider payout = delivered way count * fee per way
```

Rules:

- No rider payout item table is required for MVP.
- Rider payout uses `financial_items` with `item_type = rider_way_payout`.
- One delivered parcel creates one rider payout financial item.
- Only eligible rider payout financial items should be attached to a rider payout.

Eligible financial item rule:

```text
financial_items.item_type = rider_way_payout
financial_items.status = pending
financial_items.rider_id = selected rider
```

When payout draft is created:

- `rider_payouts.status = in_progress`
- selected rider payout `financial_items.status = in_progress`
- selected rider payout `financial_items.rider_payout_id = rider_payouts.id`
- related parcels get `rider_payout_status = in_progress`

When payout is paid:

- `rider_payouts.status = settled`
- selected rider payout `financial_items.status = settled`
- selected rider payout `financial_items.settled_at` is set
- related parcels get `rider_payout_status = settled`

If payout draft is canceled:

- `rider_payouts.status = void`
- selected rider payout `financial_items.status = pending`
- selected rider payout `financial_items.rider_payout_id = null`
- related parcels get `rider_payout_status = pending`

---

## 16. Merchant Module

### 16.1 Merchant Parcel Access

Merchant can only view own parcels.

Merchant cannot:

- Create parcel
- Edit parcel
- Delete parcel
- Update parcel status
- Assign rider

---

### 16.2 Merchant My Parcels Page

Merchant parcel listing columns:

| Column | Description |
|---|---|
| Parcel code | Unique parcel code |
| Receiver name | Customer name |
| Receiver phone | Customer phone number |
| Address | Delivery address |
| Township | Delivery township |
| COD amount | COD amount |
| Delivery fee | Delivery fee |
| Status | Parcel status |
| Created date | Parcel creation date |

---

### 16.3 Merchant Search and Filter

Merchant should be able to:

- Search parcels by receiver phone number
- Filter parcels by date
- Filter parcels by status, recommended

Search box should be separate from the filter panel.

Recommended layout:

```text
[Search by phone number] [Date range filter] [Status filter]
```

---

### 16.4 Merchant Payment Stats

From merchant view, COD remittance should be displayed as:

```text
Received Payment
```

Recommended merchant stats cards:

| Card | Meaning |
|---|---|
| Total COD | Total COD from delivered parcels |
| Received Payment | COD already paid to merchant |
| Pending Payment | COD not yet paid to merchant |
| Delivery Fee Deduction | Delivery fee deducted from returned parcels |

---

## 17. Delivery Fee Rules

### 17.1 Delivery Fee Collection

Delivery fee is always collected from receiver for normal delivered parcels.

There is no merchant-paid delivery fee at parcel creation in MVP.

For returned parcels, delivery fee is deducted from merchant COD settlement after the parcel is physically returned to merchant.

---

### 17.2 Delivery Fee Auto Fill

When admin selects township in parcel form:

- System auto-fills delivery fee from delivery pricing.
- Delivery fee can be edited only before rider assignment.
- Only super admin can manually edit delivery fee.

---

### 17.3 Delivery Fee Lock Rule

Delivery fee is locked after rider assignment.

Delivery fee is editable only when:

```text
parcel status = at_office
rider = empty
current user = super admin
```

---

## 18. COD and Collection Rules

### 18.1 COD Parcel

For COD parcel, rider collects:

```text
COD amount + delivery fee
```

---

### 18.2 Non-COD Parcel

For non-COD parcel, rider collects:

```text
delivery fee
```

---

### 18.3 Delivered Parcel

When parcel is delivered:

- COD status is updated.
- Delivery fee status is updated.
- Collected amount is recorded.
- Collection status becomes received by rider.
- Parcel becomes eligible for rider payout.
- COD parcel creates one `cod_remit` financial item for merchant settlement.
- Delivered parcel creates one `rider_way_payout` financial item for rider payout.

---

### 18.4 Failed Parcel

When delivery fails:

1. Admin changes status to `canceled_returned`.
2. Rider expected collection amount reduces immediately.
3. No delivery fee deduction happens yet.
4. Parcel must be returned to merchant.
5. Admin changes status to `returned_to_merchant` after physical return.
6. One `delivery_fee_deduction` financial item is created.
7. Delivery fee becomes eligible for deduction from merchant settlement.

---

## 19. Financial Items

Financial items are ready rows for merchant settlement and rider payout.

Financial items are not a full accounting ledger.

They are created from parcel status changes and are used by merchant settlement.
They are created from parcel status changes and are used by merchant settlement and rider payout.

Allowed `item_type` values:

```text
cod_remit
delivery_fee_deduction
rider_way_payout
```

Allowed `status` values:

```text
pending
in_progress
settled
void
```

---

### 19.1 COD Remit Financial Item

Created when COD parcel becomes `delivered`.

Fields:

```text
item_type = cod_remit
amount = parcel.cod_amount
status = pending
merchant_id = parcel.merchant_id
parcel_id = parcel.id
```

Purpose:

- Represents COD amount that should be remitted to merchant.

---

### 19.2 Delivery Fee Deduction Financial Item

Created when parcel becomes `returned_to_merchant`.

Fields:

```text
item_type = delivery_fee_deduction
amount = parcel.delivery_fee
status = pending
merchant_id = parcel.merchant_id
parcel_id = parcel.id
```

Purpose:

- Represents delivery fee to deduct from merchant COD settlement.

---

### 19.3 Rider Way Payout Financial Item

Created when parcel becomes `delivered`.

Fields:

```text
item_type = rider_way_payout
amount = 1
status = pending
merchant_id = parcel.merchant_id
rider_id = parcel.rider_id
parcel_id = parcel.id
```

Purpose:

- Represents one delivered way eligible for rider payout.

---

### 19.4 Financial Item Rules

Rules:

- Delivered COD parcel creates one `cod_remit` item.
- Returned-to-merchant parcel creates one `delivery_fee_deduction` item.
- Delivered parcel creates one `rider_way_payout` item.
- Non-COD delivered parcel does not create `cod_remit` item.
- Financial items are selected into merchant settlement by setting `merchant_settlement_id`.
- Financial items are selected into rider payout by setting `rider_payout_id`.
- No `merchant_settlement_items` table is required for MVP.
- No `rider_payout_items` table is required for MVP.
- If parcel status changes and a previously generated financial item is no longer valid, that financial item should be marked `void`.

---

## 20. Returned Parcel Deduction Rule

Delivery fee deduction happens only after parcel status becomes:

```text
returned_to_merchant
```

Deduction does not happen at:

```text
canceled_returned
```

Final rule:

```text
Only returned_to_merchant parcels are eligible for delivery fee deduction.
```

---

### 20.1 Deduction Formula

Returned parcel delivery fee is deducted from the merchant's total collected COD remittance.

Formula:

```text
merchant net payment = total collected COD - total returned parcel delivery fee deduction
```

Example:

```text
Collected COD from delivered parcels: 300,000 MMK
Delivery fee deduction from returned parcels: 12,000 MMK
Merchant received payment: 288,000 MMK
```

Important rule:

- Even if failed parcel COD was not collected, its delivery fee can still be deducted from other collected COD parcels in the same settlement.

---

## 21. Merchant Settlement Flow

Settlement is done manually by selected financial items.

It is not automatic by date, week, or month.

---

### 21.1 Settlement Permissions

Office admin can:

- View settlements
- Create settlement draft
- Edit draft settlement

Super admin can:

- View settlements
- Create settlement draft
- Edit draft settlement
- Cancel settlement
- Do actual bank transfer outside the system
- Mark settlement as paid

---

### 21.2 Settlement Status Flow

```text
in_progress -> settled
in_progress -> void
```

UI labels may display these as:

```text
Draft -> Paid
Draft -> Canceled
```

---

### 21.3 Draft Settlement Creation

Office admin or super admin can create settlement draft.

Settlement draft can be created from two entry points:

#### Option A: From merchant detail page

Use shadcn right-side sheet UI.

Steps:

1. Admin opens merchant parcel listing page.
2. `Settle` button is always visible.
3. Admin clicks `Settle`.
4. System opens a shadcn right-side sheet.
5. Sheet shows eligible financial items and settlement summary information.
6. Admin selects eligible financial items.
7. System calculates total COD amount.
8. System calculates returned parcel delivery fee deduction.
9. System calculates net merchant payment.
10. Admin clicks `Create`.
11. System creates settlement draft.

#### Option B: From separate settlement page

Use shadcn right-side sheet UI.

Steps:

1. Admin opens settlement listing page.
2. Admin clicks `Create Settlement`.
3. System opens a shadcn right-side sheet.
4. Admin chooses merchant from combo box.
5. Sheet shows eligible financial items and settlement summary information for the selected merchant.
6. Admin selects eligible financial items.
7. System calculates total COD amount.
8. System calculates returned parcel delivery fee deduction.
9. System calculates net merchant payment.
10. Admin clicks `Create`.
11. System creates settlement draft.

---

### 21.4 Settlement Draft Effects

When settlement draft is created:

- `merchant_settlements.status = in_progress`
- selected `financial_items.status = in_progress`
- selected `financial_items.merchant_settlement_id = settlement.id`
- related parcels get `merchant_settlement_status = in_progress`

If draft is canceled:

- `merchant_settlements.status = void`
- selected `financial_items.status = pending`
- selected `financial_items.merchant_settlement_id = null`
- related parcels get `merchant_settlement_status = pending`

---

### 21.5 Settlement Payment Confirmation

Only super admin can mark settlement as paid.

Steps:

1. Super admin opens settlement draft.
2. Super admin checks selected financial items and merchant bank account.
3. Super admin transfers money manually outside the system.
4. Super admin clicks **Mark as Paid**.
5. System records payment confirmation.
6. Merchant sees payment as **Received Payment**.

After settlement is marked as paid:

- `merchant_settlements.status = settled`
- selected `financial_items.status = settled`
- selected `financial_items.settled_at` is set
- related parcels get `merchant_settlement_status = settled`
- settlement is locked
- selected financial items cannot be included in another settlement
- payment appears in merchant payment history

---

### 21.6 Eligible Settlement Items

COD remit items are eligible if:

```text
financial_items.item_type = cod_remit
financial_items.status = pending
financial_items.merchant_id = selected merchant
```

Delivery fee deduction items are eligible if:

```text
financial_items.item_type = delivery_fee_deduction
financial_items.status = pending
financial_items.merchant_id = selected merchant
```

---

### 21.7 Settlement Calculation

Settlement calculation:

```text
total COD amount = sum of selected cod_remit financial item amounts

total delivery fee deduction = sum of selected delivery_fee_deduction financial item amounts

net merchant payment = total COD amount - total delivery fee deduction
```

If net merchant payment becomes negative, system should block or warn.

Recommended behavior:

```text
Delivery fee deductions exceed selected COD amount.
Add more COD remit items or handle remaining fee separately.
```

---

## 22. Admin Parcel Listing

Admin parcel listing should support daily operation and batch assignment.

Recommended columns:

| Column | Description |
|---|---|
| Checkbox | Multi-select parcels |
| Parcel code | Unique parcel code |
| Merchant | Merchant or shop name |
| Receiver | Receiver name |
| Phone | Receiver phone number |
| Township | Delivery township |
| COD amount | COD amount |
| Delivery fee | Delivery fee |
| Amount to collect | COD + delivery fee |
| Rider | Assigned rider |
| Status | Parcel status |
| Created date | Created date |

MVP filters:

- Township
- Parcel status
- Assignment state tabs:
  - All
  - Unassigned
  - Assigned

MVP search:

- Parcel code
- Receiver phone number
- Receiver name
- Merchant name

Not included in the current MVP parcel list filters:

- Merchant filter
- Rider filter
- Date range filter
- Pagination

---

## 23. Delivery Pricing

Delivery fee is based on township pricing.

Delivery pricing is managed from the township listing page.

Township pricing can include:

- Base delivery fee
- Base weight
- Extra weight fee
- Extra weight unit
- Volumetric divisor
- COD fee percent
- Return fee percent

Recommended pricing behavior:

- Each township has its own base delivery fee.
- Parcel weight default is 3kg.
- Delivery fee is auto-filled when township is selected.
- Super admin can manage pricing.
- Office admin can use pricing but cannot manually override delivery fee.

Future enhancement:

- Add full volume weight calculation if needed.
- Add COD fee percent logic if business starts charging COD fee separately.
- Add return fee percent logic if return fee becomes different from delivery fee.

---

## 24. Recommended Pages

### 24.0 Form Implementation Rules

All forms should use controlled values from the first render to avoid uncontrolled-to-controlled React warnings and inconsistent submitted state.

Simple forms should use server action forms with `useActionState`.
This applies to forms that are mostly text inputs, password inputs, textareas, and straightforward submit behavior.
The submitted values should be preserved after validation errors so users do not lose their input.

Examples:

- Login form
- Change password form
- Small account detail forms with basic text fields

Complex forms should use React Hook Form with server actions.
This applies to forms that include select fields, comboboxes, checkboxes, conditional sections, repeatable fields, popovers, dialogs, or multi-step/summary behavior.
React Hook Form should own client-side field state, while the server action remains the source of truth for validation, permissions, and persistence.

Examples:

- Create/edit user form
- Bank account create/edit form
- Create/edit parcel form
- Assign rider form
- Township pricing form
- Settlement and rider payout draft forms

Validation rules:

- Validate all submitted data on the server with Zod.
- Client-side validation can improve UX, but must not replace server validation.
- Server action responses should return field-level or form-level errors where practical.
- Form controls should receive explicit default values such as empty strings, booleans, arrays, or null-safe option values.

### 24.1 Admin / Super Admin Pages

Recommended routes and UI patterns:

```text
/dashboard
  Main dashboard page.

/dashboard/parcels
  Parcel listing page.

/dashboard/parcels/create
  Opens as shadcn right-side sheet from parcel listing page.

/dashboard/parcels/[id]
  Opens as shadcn right-side sheet for parcel detail view.

/dashboard/parcels/[id]/edit
  Opens as shadcn right-side sheet for parcel editing.

/dashboard/merchants
  Merchant listing page.

/dashboard/merchants/[id]/parcels
  Merchant parcel listing page which includes always-visible `Settle` button for settlement draft creation.

/dashboard/riders
  Rider listing page.

/dashboard/riders/[id]/parcels
  Rider parcel listing page.

/dashboard/riders/[id]/payouts
  Rider payout history page.

/dashboard/users
  User listing page.

/dashboard/users/create
  Opens as shadcn right-side sheet.
  Can create rider, merchant, or office admin account.

/dashboard/users/[id]
  Opens as shadcn dialog for user detail view.

/dashboard/users/[id]/edit
  Opens as shadcn right-side sheet.
  Includes 2 tabs: account detail and bank account.

/dashboard/settlements
  Settlement listing page.
  Includes `Create Settlement` button.

/dashboard/settlements/create
  Opens as shadcn right-side sheet from settlement listing page.
  Sheet includes merchant combo box, eligible financial items, and settlement summary information.

/dashboard/settlements/[id]
  Settlement detail page.
  Shows settlement financial items and action buttons such as edit, cancel, and mark paid.

/dashboard/settlements/[id]/edit
  Opens as shadcn right-side sheet for draft settlement editing.

/dashboard/rider-payouts
  Rider payout listing page.
  Includes `Create Payout` button.

/dashboard/rider-payouts/create
  Opens as shadcn right-side sheet.
  Sheet includes rider combo box, eligible rider payout financial items, delivered way count, fee per way, and payout summary.

/dashboard/rider-payouts/[id]
  Rider payout detail page.
  Shows payout summary, included rider payout financial items, and related parcels.

/dashboard/townships
  Township listing page.
  Includes delivery pricing fields for each township.

/dashboard/townships/create
  Opens as shadcn right-side sheet from township listing page.

/dashboard/townships/[id]
  Opens as shadcn dialog for township detail view from explicit `View` action in the listing.

/dashboard/townships/[id]/edit
  Opens as shadcn right-side sheet for township editing.

/dashboard/settings
  Settings page.

/dashboard/settings?tab=account
  Account settings tab.

/dashboard/settings?tab=bank-accounts
  Bank accounts settings tab.
  Create and edit open as shadcn dialog.
```

---

### 24.2 Merchant Pages

```text
/dashboard/merchant/parcels
  Merchant parcel listing page.

/dashboard/merchant/payments
  Merchant payment or settlement history page.

/dashboard/settings?tab=account
  Account settings page.

/dashboard/settings?tab=bank-accounts
  Bank account settings page.
```

---

### 24.3 Rider Pages

```text
/dashboard/rider/parcels
  Rider parcel listing page.

/dashboard/rider/payments
  Rider payout history page.

/dashboard/settings?tab=account
  Account settings page.

/dashboard/settings?tab=bank-accounts
  Bank account settings page.
```

---

## 25. MVP Must-Have Features

- Username and password login
- Admin-created user accounts
- Password regeneration by admin
- Four roles
- User settings with account details and bank accounts tab
- Parcel creation by admin
- Parcel code generation
- Merchant parcel visibility
- Rider parcel assignment
- Rider parcel listing
- Rider start delivery update
- Rider successful delivery update
- Admin failed/postpone/return status update
- Township-based delivery fee auto-fill
- Super admin delivery fee override before assignment
- Rider expected collection amount
- Rider actual collected amount
- Office collection confirmation
- Merchant parcel search and filter
- Rider parcel search and filter
- Admin parcel search, filter, and batch assignment
- Financial item generation from delivered / returned parcels
- Merchant settlement draft creation from financial items
- Super admin settlement payment confirmation
- Returned parcel delivery fee deduction
- Rider payout by delivered way count
- Status change logs

---

## 26. Out of Scope for MVP

These features are not required in MVP:

- Public merchant signup
- Phone verification
- OTP login
- Telegram integration inside app
- Automatic pickup request creation
- GPS rider tracking
- Receipt upload
- Mobile app
- Advanced analytics
- Multiple delivery attempts table
- Automatic weekly or monthly settlement
- Merchant parcel creation
- Merchant parcel editing
- User bank account self-editing
- Separate parcel payment records table
- Merchant settlement items table
- Rider payout items table
- Full accounting ledger

---

## 27. Final Business Rules Summary

- Parcel Flow starts after parcel arrives at office.
- No public signup.
- Login uses username and password.
- Admin creates all user accounts.
- Office admin can regenerate passwords, except for super admin accounts.
- Delivery fee is normally collected from receiver.
- Merchant cannot create or edit parcels.
- Rider only sees assigned parcels.
- Parcel status remains unchanged after assignment; eligible delivery parcels change to `on_the_way` only when rider starts delivery.
- Rider can start delivery and mark parcel as delivered.
- Admin handles postpone, failed, and returned statuses.
- Delivery fee can be manually edited only by super admin before assignment.
- Parcel code format is `PF-XXXXXX-XXXXXX`.
- Parcel payment statuses are stored directly on `parcels`.
- Rider expected collection amount reduces when parcel becomes `canceled_returned`.
- Failed parcel delivery fee deduction happens only after `returned_to_merchant`.
- Delivered COD parcel creates one `cod_remit` financial item.
- Returned-to-merchant parcel creates one `delivery_fee_deduction` financial item.
- Merchant settlement is created from selected financial items.
- Office admin can create settlement draft.
- Super admin performs actual bank transfer and marks settlement as paid.
- Merchant sees paid COD settlement as **Received Payment**.
- Rider payout is calculated by delivered way count and fee per way.
- Rider payout uses selected `rider_way_payout` financial items.
