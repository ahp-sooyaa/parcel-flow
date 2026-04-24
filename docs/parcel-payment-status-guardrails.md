# Parcel Payment Status Guardrails

## Purpose

This document is a planning reference for parcel UI and server-side guardrails. It describes how parcel status, COD status, collection status, delivery fee status, and merchant settlement status should work together.

The goal is to prevent nonsensical status combinations and keep merchant settlement accounting auditable.

## Core Principle

Parcel movement and parcel payment state are related, but they should not be treated as independent dropdowns.

The UI should guide users through valid operational actions. The server should enforce the same rules and fail closed when a submitted status combination is invalid.

## Status Ownership

| Field                        | Meaning                                                    | Owner                                      |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| `parcels.status`             | Physical parcel lifecycle                                  | Operations, rider action, admin correction |
| `delivery_fee_payer`         | Who is expected to pay the delivery fee                    | Parcel creation or admin correction        |
| `delivery_fee_status`        | How the delivery fee was actually handled                  | Office/accounting reconciliation           |
| `cod_status`                 | Whether COD applies and whether COD was collected          | Delivery/cash reconciliation               |
| `collection_status`          | Where the collected cash is in custody                     | Rider and office reconciliation            |
| `merchant_settlement_status` | Whether COD is available, locked, or settled with merchant | Merchant settlement workflow only          |
| `rider_payout_status`        | Whether rider payout is pending, locked, or paid           | Rider payout workflow only                 |

`merchant_settlement_status` should not be manually editable from the parcel edit form. It is controlled by settlement generation, payment confirmation, cancellation, and rejection.

`rider_payout_status` should also remain read-only until a dedicated rider payout workflow owns it.

## Parcel Lifecycle

Recommended forward flow:

```text
pending
out_for_pickup
at_office
out_for_delivery
delivered
```

Recommended return flow:

```text
out_for_delivery
return_to_office
return_to_merchant
returned
```

`cancelled` is an admin-only terminal status. It should normally be available only before the parcel has entered completed financial workflows.

`at_office` means the parcel is physically at the office. It does not mean the parcel is delivered, COD is collected, or delivery fee handling is resolved.

## Delivery Fee Status Meanings

| Status                    | Meaning                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `unpaid`                  | Delivery fee is unresolved. No one has paid it and no accounting decision has been made.                                |
| `paid_by_merchant`        | Merchant already paid the delivery fee outside this parcel's COD settlement.                                            |
| `collected_from_receiver` | Receiver paid the delivery fee during delivery.                                                                         |
| `deduct_from_settlement`  | Company will recover the merchant-paid delivery fee by deducting it from this parcel's merchant COD settlement.         |
| `bill_merchant`           | Merchant owes the delivery fee, but it will be billed separately instead of deducted from this parcel's COD settlement. |
| `waived`                  | Company intentionally waived the delivery fee. This should require an admin/accounting note.                            |

## When To Use `deduct_from_settlement`

`deduct_from_settlement` should be an explicit office/accounting reconciliation decision made before settlement generation.

It should not be automatically set when a parcel reaches `at_office`.

It should not be silently decided during settlement generation.

Recommended timing:

```text
1. Parcel is delivered.
2. COD is collected from receiver.
3. Rider hands COD cash to office.
4. Office reconciles cash and delivery fee handling.
5. If merchant-paid delivery fee should be deducted from COD settlement, set delivery_fee_status to deduct_from_settlement.
6. Settlement generation snapshots the already-resolved status.
```

Required conditions for `deduct_from_settlement`:

| Field                        | Required value              |
| ---------------------------- | --------------------------- |
| `parcel_type`                | `cod`                       |
| `parcels.status`             | `delivered`                 |
| `cod_status`                 | `collected`                 |
| `collection_status`          | `received_by_office`        |
| `delivery_fee_payer`         | `merchant`                  |
| `delivery_fee`               | greater than `0`            |
| `cod_amount`                 | greater than `delivery_fee` |
| `merchant_settlement_status` | `pending`                   |
| `merchant_settlement_id`     | `null`                      |

If these conditions are not true, `deduct_from_settlement` should be rejected.

## Why Not At `at_office`

Do not automatically change:

```text
status = at_office
delivery_fee_status = unpaid
```

to:

```text
delivery_fee_status = deduct_from_settlement
```

Reason:

- The parcel has not been delivered yet.
- The receiver may still pay the delivery fee during delivery.
- The parcel may be returned.
- COD may never be collected.
- Office may choose to bill the merchant separately.
- No merchant settlement has been generated or reviewed yet.

`at_office` is a logistics state, not a financial resolution state.

## Settlement Generation Rule

Settlement generation should only include parcels whose payment state is already clean and resolved.

Eligible merchant settlement parcels should require:

| Field                        | Required value       |
| ---------------------------- | -------------------- |
| `parcels.merchant_id`        | selected merchant    |
| `parcels.status`             | `delivered`          |
| `parcel_type`                | `cod`                |
| `cod_status`                 | `collected`          |
| `collection_status`          | `received_by_office` |
| `merchant_settlement_status` | `pending`            |
| `merchant_settlement_id`     | `null`               |

Additional delivery fee guardrail:

```text
If delivery_fee_payer = merchant
and delivery_fee_status = unpaid
then block settlement generation.
```

The user should resolve the delivery fee before generating settlement by choosing one of:

| Resolution               | When to use                                      |
| ------------------------ | ------------------------------------------------ |
| `paid_by_merchant`       | Merchant already paid the fee directly.          |
| `deduct_from_settlement` | Fee should be deducted from this COD settlement. |
| `bill_merchant`          | Fee should be billed separately.                 |
| `waived`                 | Fee is intentionally waived.                     |

Settlement generation should not silently convert `unpaid` to `deduct_from_settlement`.

## Settlement Snapshot Behavior

When settlement generation runs, it should snapshot current parcel payment values.

For each selected parcel:

| Current delivery fee status       | Settlement item behavior                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `deduct_from_settlement`          | Snapshot COD amount, snapshot delivery fee, mark delivery fee deducted, net payable equals COD amount minus delivery fee. |
| any other allowed resolved status | Snapshot COD amount, mark delivery fee not deducted, net payable equals full COD amount.                                  |

After generation:

```text
merchant_settlement_id = generated settlement id
merchant_settlement_status = in_progress
```

After settlement payment confirmation:

```text
merchant_settlement_status = settled
```

After settlement cancellation or rejection before payment:

```text
merchant_settlement_id = null
merchant_settlement_status = pending
```

## Invalid Combination Examples

These combinations should be blocked by the server and should not be offered by the UI.

| Invalid combination                                                                          | Reason                                                                      |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `parcel_type = non_cod` and `cod_status != not_applicable`                                   | Non-COD parcels cannot have collectible COD.                                |
| `parcel_type = cod` and `cod_status = not_applicable`                                        | COD parcels require a COD collection state.                                 |
| `parcels.status = delivered` and `cod_status = pending`                                      | Delivered COD state is financially incomplete.                              |
| `collection_status = received_by_office` and `cod_status != collected`                       | Office cannot receive COD that was not collected.                           |
| `delivery_fee_payer = receiver` and `delivery_fee_status = deduct_from_settlement`           | Receiver-paid delivery fee should not be deducted from merchant settlement. |
| `delivery_fee_payer = merchant` and `delivery_fee_status = collected_from_receiver`          | Receiver should not be marked as paying a merchant-paid fee.                |
| `delivery_fee_status = deduct_from_settlement` and `collection_status != received_by_office` | Do not deduct from settlement until COD cash is held by office.             |
| `merchant_settlement_status = in_progress` and `merchant_settlement_id = null`               | A locked settlement state requires a settlement link.                       |
| `merchant_settlement_status = settled` and `merchant_settlement_id = null`                   | A settled state requires a settlement link.                                 |

## UI Recommendations

Parcel edit should be split by intent instead of exposing all statuses as independent dropdowns.

Recommended sections:

| Section             | Purpose                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| Parcel details      | Recipient, address, package info, rider assignment.                         |
| Operational status  | Show only valid next parcel actions.                                        |
| Cash reconciliation | Record COD collected, cash received by office, and delivery fee resolution. |
| Settlement state    | Read-only status and link to settlement when present.                       |
| Admin correction    | Restricted correction path requiring a note and audit log.                  |

The settlement picker should clearly exclude unresolved parcels and explain why a parcel is blocked.

Useful blocked reasons:

- COD not collected.
- COD not received by office.
- Delivery fee is unresolved.
- Parcel is already locked by a settlement.
- Parcel is already settled.
- Parcel is not delivered.

## Planning Notes

Future implementation should add shared server helpers for:

- allowed parcel status transitions
- payment status invariants
- settlement eligibility
- blocked settlement reason labels
- read-only/system-owned status fields

The same helpers should be used by the UI and server actions so the visible workflow and enforced workflow stay consistent.
