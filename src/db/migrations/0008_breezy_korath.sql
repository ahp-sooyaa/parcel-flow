CREATE TABLE "parcel_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"source_table" text NOT NULL,
	"event" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcel_payment_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"delivery_fee_status" text DEFAULT 'unpaid' NOT NULL,
	"cod_status" text DEFAULT 'pending' NOT NULL,
	"collected_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"collection_status" text DEFAULT 'pending' NOT NULL,
	"merchant_settlement_status" text DEFAULT 'pending' NOT NULL,
	"rider_payout_status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_code" text NOT NULL,
	"merchant_id" uuid NOT NULL,
	"rider_id" uuid,
	"recipient_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"recipient_township_id" uuid NOT NULL,
	"recipient_address" text NOT NULL,
	"cod_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"delivery_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"delivery_fee_payer" text DEFAULT 'receiver' NOT NULL,
	"parcel_type" text DEFAULT 'cod' NOT NULL,
	"total_amount_to_collect" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parcel_audit_logs" ADD CONSTRAINT "parcel_audit_logs_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_audit_logs" ADD CONSTRAINT "parcel_audit_logs_updated_by_app_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."app_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_payment_records" ADD CONSTRAINT "parcel_payment_records_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_merchant_id_merchants_app_user_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("app_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_rider_id_riders_app_user_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("app_user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_recipient_township_id_townships_id_fk" FOREIGN KEY ("recipient_township_id") REFERENCES "public"."townships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parcel_audit_logs_parcel_idx" ON "parcel_audit_logs" USING btree ("parcel_id");--> statement-breakpoint
CREATE INDEX "parcel_audit_logs_updated_by_idx" ON "parcel_audit_logs" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "parcel_audit_logs_source_table_idx" ON "parcel_audit_logs" USING btree ("source_table");--> statement-breakpoint
CREATE INDEX "parcel_audit_logs_created_at_idx" ON "parcel_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "parcel_payment_records_parcel_uidx" ON "parcel_payment_records" USING btree ("parcel_id");--> statement-breakpoint
CREATE INDEX "parcel_payment_records_delivery_fee_status_idx" ON "parcel_payment_records" USING btree ("delivery_fee_status");--> statement-breakpoint
CREATE INDEX "parcel_payment_records_collection_status_idx" ON "parcel_payment_records" USING btree ("collection_status");--> statement-breakpoint
CREATE INDEX "parcel_payment_records_merchant_settlement_idx" ON "parcel_payment_records" USING btree ("merchant_settlement_status");--> statement-breakpoint
CREATE INDEX "parcel_payment_records_rider_payout_idx" ON "parcel_payment_records" USING btree ("rider_payout_status");--> statement-breakpoint
CREATE UNIQUE INDEX "parcels_code_uidx" ON "parcels" USING btree ("parcel_code");--> statement-breakpoint
CREATE INDEX "parcels_merchant_idx" ON "parcels" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "parcels_rider_idx" ON "parcels" USING btree ("rider_id");--> statement-breakpoint
CREATE INDEX "parcels_recipient_township_idx" ON "parcels" USING btree ("recipient_township_id");--> statement-breakpoint
CREATE INDEX "parcels_status_idx" ON "parcels" USING btree ("status");--> statement-breakpoint
CREATE INDEX "parcels_created_at_idx" ON "parcels" USING btree ("created_at");