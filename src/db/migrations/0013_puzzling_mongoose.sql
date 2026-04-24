ALTER TABLE "parcels" ADD COLUMN "delivery_fee_payment_plan" text;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_delivery_fee_payment_plan_check" CHECK ((
                "parcels"."delivery_fee_payment_plan" is null
                or (
                    "parcels"."delivery_fee_payer" = 'receiver'
                    and "parcels"."delivery_fee_payment_plan" = 'receiver_collect_on_delivery'
                )
                or (
                    "parcels"."delivery_fee_payer" = 'merchant'
                    and "parcels"."delivery_fee_payment_plan" in (
                        'merchant_prepaid_bank_transfer',
                        'merchant_cash_on_pickup',
                        'merchant_bill_later'
                    )
                )
                or (
                    "parcels"."delivery_fee_payer" = 'merchant'
                    and "parcels"."parcel_type" = 'cod'
                    and "parcels"."delivery_fee_payment_plan" = 'merchant_deduct_from_cod_settlement'
                )
            ));