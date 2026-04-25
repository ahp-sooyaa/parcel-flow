CREATE TABLE "merchant_financial_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"source_obligation_key" text NOT NULL,
	"source_parcel_id" uuid,
	"source_payment_record_id" uuid,
	"merchant_settlement_id" uuid,
	"kind" text NOT NULL,
	"direction" text NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"readiness" text DEFAULT 'blocked' NOT NULL,
	"blocked_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lifecycle_state" text DEFAULT 'open' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "merchant_settlement_items_settlement_payment_uidx";--> statement-breakpoint
ALTER TABLE "merchant_settlement_items" ALTER COLUMN "parcel_payment_record_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ALTER COLUMN "bank_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ALTER COLUMN "snapshot_bank_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ALTER COLUMN "snapshot_bank_account_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_settlement_items" ADD COLUMN "merchant_financial_item_id" uuid;--> statement-breakpoint
ALTER TABLE "merchant_settlement_items" ADD COLUMN "parcel_id" uuid;--> statement-breakpoint
ALTER TABLE "merchant_settlement_items" ADD COLUMN "candidate_kind" text DEFAULT 'cod_remit_credit' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_settlement_items" ADD COLUMN "direction" text DEFAULT 'company_owes_merchant' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_settlement_items" ADD COLUMN "snapshot_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD COLUMN "credits_total" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD COLUMN "debits_total" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_financial_items" ADD CONSTRAINT "merchant_financial_items_merchant_id_merchants_app_user_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("app_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_financial_items" ADD CONSTRAINT "merchant_financial_items_source_parcel_id_parcels_id_fk" FOREIGN KEY ("source_parcel_id") REFERENCES "public"."parcels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_financial_items" ADD CONSTRAINT "merchant_financial_items_source_payment_record_id_parcel_payment_records_id_fk" FOREIGN KEY ("source_payment_record_id") REFERENCES "public"."parcel_payment_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_financial_items" ADD CONSTRAINT "merchant_financial_items_merchant_settlement_id_merchant_settlements_id_fk" FOREIGN KEY ("merchant_settlement_id") REFERENCES "public"."merchant_settlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_financial_items_merchant_idx" ON "merchant_financial_items" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_financial_items_merchant_readiness_idx" ON "merchant_financial_items" USING btree ("merchant_id","lifecycle_state","readiness");--> statement-breakpoint
CREATE INDEX "merchant_financial_items_parcel_idx" ON "merchant_financial_items" USING btree ("source_parcel_id");--> statement-breakpoint
CREATE INDEX "merchant_financial_items_payment_record_idx" ON "merchant_financial_items" USING btree ("source_payment_record_id");--> statement-breakpoint
CREATE INDEX "merchant_financial_items_settlement_idx" ON "merchant_financial_items" USING btree ("merchant_settlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_financial_items_source_obligation_uidx" ON "merchant_financial_items" USING btree ("merchant_id","source_obligation_key") WHERE "merchant_financial_items"."lifecycle_state" <> 'void';--> statement-breakpoint
ALTER TABLE "merchant_settlement_items" ADD CONSTRAINT "merchant_settlement_items_merchant_financial_item_id_merchant_financial_items_id_fk" FOREIGN KEY ("merchant_financial_item_id") REFERENCES "public"."merchant_financial_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settlement_items" ADD CONSTRAINT "merchant_settlement_items_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_settlement_items_financial_item_idx" ON "merchant_settlement_items" USING btree ("merchant_financial_item_id");--> statement-breakpoint
CREATE INDEX "merchant_settlement_items_parcel_idx" ON "merchant_settlement_items" USING btree ("parcel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_settlement_items_settlement_financial_item_uidx" ON "merchant_settlement_items" USING btree ("merchant_settlement_id","merchant_financial_item_id");