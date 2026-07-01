CREATE INDEX "bank_accounts_primary_user_id_idx" ON "bank_accounts" USING btree ("user_id") WHERE "bank_accounts"."is_primary" and "bank_accounts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "financial_items_parcel_id_idx" ON "financial_items" USING btree ("parcel_id");--> statement-breakpoint
CREATE INDEX "financial_items_settlement_eligibility_idx" ON "financial_items" USING btree ("merchant_id","created_at") WHERE "financial_items"."status" = 'pending' and "financial_items"."merchant_settlement_id" is null;--> statement-breakpoint
CREATE INDEX "financial_items_rider_payout_eligibility_idx" ON "financial_items" USING btree ("rider_id","created_at") WHERE "financial_items"."item_type" = 'rider_way_payout' and "financial_items"."rider_payout_id" is null;--> statement-breakpoint
CREATE INDEX "merchant_settlements_merchant_status_created_idx" ON "merchant_settlements" USING btree ("merchant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "merchants_user_id_idx" ON "merchants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "parcels_active_created_at_idx" ON "parcels" USING btree ("created_at") WHERE "parcels"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "parcels_active_merchant_id_idx" ON "parcels" USING btree ("merchant_id") WHERE "parcels"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "parcels_active_rider_id_idx" ON "parcels" USING btree ("rider_id") WHERE "parcels"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "parcels_active_status_received_idx" ON "parcels" USING btree ("status","is_received_by_office") WHERE "parcels"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "rider_payouts_created_at_idx" ON "rider_payouts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "riders_user_id_idx" ON "riders" USING btree ("user_id");
