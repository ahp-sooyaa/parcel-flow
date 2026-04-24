# Parcel Create And Delivery Fee Payment Plan

## Decision Summary

Parcel create is for starting a new operational parcel workflow. It should not be used for historical backfill or post-delivery data entry.

Historical/backfill parcels will be handled later through a dedicated import workflow, likely from an Excel sheet. That import workflow does not exist yet and should be designed separately.

We will add a new parcel field:

```text
delivery_fee_payment_plan
```

This field records how the delivery fee is expected to be paid at parcel creation time. It is separate from `delivery_fee_status`, which records what has actually been reconciled.

## Why This Is Needed

Current create behavior stores:

```text
delivery_fee_status = unpaid
```

for every new parcel.

That is too broad because `unpaid` can mean several different operational intentions:

- Merchant already transferred money, but office has not verified it.
- Merchant will pay cash when the rider picks up the parcel.
- Merchant wants the fee deducted from COD settlement.
- Merchant wants to be billed later.
- Receiver will pay the delivery fee during delivery.

These cases should not be inferred later from `delivery_fee_status` alone.

## Field Responsibilities

| Field                       | Meaning                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `delivery_fee_payer`        | Who is responsible for the fee: merchant or receiver.          |
| `delivery_fee_payment_plan` | How/when the responsible party intends to pay the fee.         |
| `delivery_fee_status`       | What actually happened after office/accounting reconciliation. |

`delivery_fee_status` remains the accounting truth. `delivery_fee_payment_plan` is the operational expectation captured at create time.

## Planned Payment Plan Values

Recommended values:

```text
receiver_collect_on_delivery
merchant_prepaid_bank_transfer
merchant_cash_on_pickup
merchant_deduct_from_cod_settlement
merchant_bill_later
```

Meaning:

| Value                                 | Meaning                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `receiver_collect_on_delivery`        | Receiver will pay the delivery fee during delivery.                      |
| `merchant_prepaid_bank_transfer`      | Merchant says they paid or will pay by bank transfer before pickup.      |
| `merchant_cash_on_pickup`             | Merchant will pay cash to the rider during pickup.                       |
| `merchant_deduct_from_cod_settlement` | Merchant wants the fee deducted from the parcel's future COD settlement. |
| `merchant_bill_later`                 | Merchant wants the delivery fee billed separately later.                 |

## Guardrails

Suggested validation rules:

- If `delivery_fee_payer = receiver`, payment plan should be `receiver_collect_on_delivery`.
- If `delivery_fee_payer = merchant`, payment plan should be one of the merchant payment plans.
- `merchant_deduct_from_cod_settlement` should require `parcel_type = cod`.
- `merchant_prepaid_bank_transfer` may allow a payment slip upload, but the slip does not automatically prove payment.
- `delivery_fee_status` should still start as `unpaid` unless an office/admin workflow explicitly verifies payment during create.
- `delivery_fee_status = paid_by_merchant` should be set only after office verifies merchant payment.
- `delivery_fee_status = deduct_from_settlement` should be set only during office reconciliation after delivery, COD collection, and cash receipt by office.

## Create Form Behavior

Normal parcel create should represent a new parcel before pickup.

The create form should not ask for:

- pickup images
- proof of delivery images

Those belong to later operational steps.

Payment slip upload should be shown only when the selected payment plan is `merchant_prepaid_bank_transfer`. The uploaded slip should be treated as evidence to review, not as automatic payment confirmation.

For merchant-created parcels, uploaded bank-transfer evidence should not let the merchant mark the fee as paid. Office verification is still required.

## Backfill Decision

We will not use the parcel create form for historical/backfill records.

Backfill will be handled by a future import feature:

- User prepares parcel data in an Excel sheet.
- System imports the sheet through an admin-only workflow.
- Import can support historical statuses, payment states, pickup images, proof-of-delivery evidence, and notes if needed.
- Import should write explicit audit events and require a backfill/import note.

This keeps normal parcel creation clean and avoids mixing "start a new parcel" with "record something that already happened."

## Open Implementation Notes

Future implementation should update:

- Drizzle schema and generated migration for `delivery_fee_payment_plan`.
- Parcel create schema and form.
- Parcel edit/detail DTOs if the plan needs to be displayed after create.
- Server validation helpers so payer and plan combinations fail closed.
- Tests for valid and invalid payer/payment-plan combinations.
