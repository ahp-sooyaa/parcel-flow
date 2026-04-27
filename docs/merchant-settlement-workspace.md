# Merchant Settlement Workspace

## Operator Notes

- Use `Open Settlement Workspace` from a merchant detail page to review every current settlement candidate for that merchant in one place.
- Use `Process Settlement` from `COD in Held` to jump in with delivered COD remit candidates preselected.
- Use `Resolve Fees` from `Pending Delivery Fee` to focus on merchant debit candidates created from `bill_merchant` delivery fees.
- Use `Handle Returns` from `Returned` to focus on return and refund-related settlement work.
- Ready candidates can be selected and combined into one document. The summary bar shows credits, debits, net amount, and whether the result is a remit, invoice, or balanced document.
- Remit documents require a merchant bank account because the company is paying the merchant.
- Invoice documents require a company bank account because the merchant is paying the company.
- Balanced documents do not require bank details and close immediately with no payment confirmation step.
- Blocked candidates stay visible with reasons so operators can fix parcel or payment state before retrying settlement.

## Candidate Rules

- `cod_remit_credit`: created from delivered COD parcels when COD is collected, received by office, and financially ready for settlement.
- `delivery_fee_charge`: created when the parcel reaches a merchant-billed fee outcome through `bill_merchant`.
- `refund_credit`: created only for cancelled parcels when the merchant prepaid delivery fee was actually verified as received.

## Refund Eligibility

- Merchant receipt evidence alone is not enough.
- Refund credits are created only after the parcel is cancelled and the delivery fee is marked as verified `paid_by_merchant`.
- If the prepaid fee is not verified yet, the refund candidate stays blocked instead of becoming selectable.

## Internal Notes

- Merchant settlement generation now locks merchant financial items rather than raw parcel payment record ids.
- Parcel and payment mutations reconcile merchant financial items after every create or update path so candidate state can be rebuilt from parcel truth.
- Settlement history and detail pages read credits, debits, net totals, direction, and snapshot values from settlement item snapshots.
- Legacy COD settlement rows remain readable because mixed settlement totals are derived from stored settlement item snapshots.
