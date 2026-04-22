CREATE TABLE "merchant_settlement_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_settlement_id" uuid NOT NULL,
	"parcel_payment_record_id" uuid NOT NULL,
	"snapshot_cod_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"snapshot_delivery_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_delivery_fee_deducted" boolean DEFAULT false NOT NULL,
	"net_payable_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_no" text,
	"merchant_id" uuid NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"method" text DEFAULT 'bank_transfer' NOT NULL,
	"snapshot_bank_name" text NOT NULL,
	"snapshot_bank_account_number" text NOT NULL,
	"created_by" uuid NOT NULL,
	"confirmed_by" uuid,
	"payment_slip_image_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"type" text DEFAULT 'remit' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parcel_payment_records" ADD COLUMN "merchant_settlement_id" uuid;--> statement-breakpoint
ALTER TABLE "merchant_settlement_items" ADD CONSTRAINT "merchant_settlement_items_merchant_settlement_id_merchant_settlements_id_fk" FOREIGN KEY ("merchant_settlement_id") REFERENCES "public"."merchant_settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settlement_items" ADD CONSTRAINT "merchant_settlement_items_parcel_payment_record_id_parcel_payment_records_id_fk" FOREIGN KEY ("parcel_payment_record_id") REFERENCES "public"."parcel_payment_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_merchant_id_merchants_app_user_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("app_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_confirmed_by_app_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."app_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_settlement_items_settlement_idx" ON "merchant_settlement_items" USING btree ("merchant_settlement_id");--> statement-breakpoint
CREATE INDEX "merchant_settlement_items_payment_record_idx" ON "merchant_settlement_items" USING btree ("parcel_payment_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_settlement_items_settlement_payment_uidx" ON "merchant_settlement_items" USING btree ("merchant_settlement_id","parcel_payment_record_id");--> statement-breakpoint
CREATE INDEX "merchant_settlements_merchant_idx" ON "merchant_settlements" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_settlements_bank_account_idx" ON "merchant_settlements" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "merchant_settlements_status_idx" ON "merchant_settlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "merchant_settlements_created_by_idx" ON "merchant_settlements" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "merchant_settlements_confirmed_by_idx" ON "merchant_settlements" USING btree ("confirmed_by");--> statement-breakpoint
CREATE INDEX "merchant_settlements_created_at_idx" ON "merchant_settlements" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_settlements_reference_no_uidx" ON "merchant_settlements" USING btree ("reference_no") WHERE "merchant_settlements"."reference_no" is not null;--> statement-breakpoint
ALTER TABLE "parcel_payment_records" ADD CONSTRAINT "parcel_payment_records_merchant_settlement_id_merchant_settlements_id_fk" FOREIGN KEY ("merchant_settlement_id") REFERENCES "public"."merchant_settlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parcel_payment_records_merchant_settlement_id_idx" ON "parcel_payment_records" USING btree ("merchant_settlement_id");