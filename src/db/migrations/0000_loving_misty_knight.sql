CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"display_username" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone_number" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"age" integer,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_reset_password" boolean DEFAULT false NOT NULL,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_holder_name" text NOT NULL,
	"account_number" text NOT NULL,
	"is_company_account" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "financial_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid,
	"merchant_id" uuid,
	"rider_id" uuid,
	"merchant_settlement_id" uuid,
	"rider_payout_id" uuid,
	"item_type" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "merchant_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_code" text NOT NULL,
	"merchant_id" uuid NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"total_cod_amount" integer DEFAULT 0 NOT NULL,
	"total_delivery_fee_deduction" integer DEFAULT 0 NOT NULL,
	"net_payment_amount" integer DEFAULT 0 NOT NULL,
	"bank_account_id" uuid,
	"created_by" uuid,
	"paid_by" uuid,
	"paid_at" timestamp with time zone,
	"payment_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"shop_name" text NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcel_status_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"old_status" text,
	"new_status" text NOT NULL,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_code" text NOT NULL,
	"merchant_id" uuid NOT NULL,
	"rider_id" uuid,
	"township_id" uuid NOT NULL,
	"receiver_name" text NOT NULL,
	"receiver_phone_number" text NOT NULL,
	"receiver_address" text NOT NULL,
	"parcel_type" text NOT NULL,
	"cod_amount" integer DEFAULT 0 NOT NULL,
	"delivery_fee" integer NOT NULL,
	"weight_kg" numeric(10, 2) DEFAULT '3' NOT NULL,
	"is_large_parcel" boolean DEFAULT false NOT NULL,
	"parcel_width_cm" numeric(10, 2),
	"parcel_height_cm" numeric(10, 2),
	"parcel_length_cm" numeric(10, 2),
	"special_notes" text,
	"status" text DEFAULT 'at_office' NOT NULL,
	"collected_amount" integer DEFAULT 0 NOT NULL,
	"cod_status" text DEFAULT 'pending' NOT NULL,
	"delivery_fee_status" text DEFAULT 'pending' NOT NULL,
	"is_received_by_office" boolean DEFAULT false NOT NULL,
	"merchant_settlement_status" text DEFAULT 'pending' NOT NULL,
	"rider_payout_status" text DEFAULT 'pending' NOT NULL,
	"proof_of_delivery_images_keys" jsonb DEFAULT '[]'::jsonb,
	"pickup_images_keys" jsonb DEFAULT '[]'::jsonb,
	"created_by" uuid,
	"collection_confirmed_by" uuid,
	"assigned_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"returned_to_merchant_at" timestamp with time zone,
	"collected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rider_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_code" text NOT NULL,
	"rider_id" uuid NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"delivered_way_count" integer DEFAULT 0 NOT NULL,
	"fee_per_way" integer NOT NULL,
	"total_payout_amount" integer DEFAULT 0 NOT NULL,
	"bank_account_id" uuid,
	"created_by" uuid,
	"paid_by" uuid,
	"paid_at" timestamp with time zone,
	"payment_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rider_service_townships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rider_id" uuid NOT NULL,
	"township_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "riders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"impersonated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "townships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"base_fee" integer NOT NULL,
	"base_weight_kg" numeric(10, 2) DEFAULT '3' NOT NULL,
	"extra_weight_fee" integer DEFAULT 0 NOT NULL,
	"extra_weight_unit_kg" numeric(10, 2) DEFAULT '1' NOT NULL,
	"volumetric_divisor" integer DEFAULT 5000 NOT NULL,
	"cod_fee_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"return_fee_percent" numeric(5, 2) DEFAULT '100' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_items" ADD CONSTRAINT "financial_items_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_items" ADD CONSTRAINT "financial_items_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_items" ADD CONSTRAINT "financial_items_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_items" ADD CONSTRAINT "financial_items_merchant_settlement_id_merchant_settlements_id_fk" FOREIGN KEY ("merchant_settlement_id") REFERENCES "public"."merchant_settlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_items" ADD CONSTRAINT "financial_items_rider_payout_id_rider_payouts_id_fk" FOREIGN KEY ("rider_payout_id") REFERENCES "public"."rider_payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_items" ADD CONSTRAINT "financial_items_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_status_logs" ADD CONSTRAINT "parcel_status_logs_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_status_logs" ADD CONSTRAINT "parcel_status_logs_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_township_id_townships_id_fk" FOREIGN KEY ("township_id") REFERENCES "public"."townships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_collection_confirmed_by_user_id_fk" FOREIGN KEY ("collection_confirmed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_payouts" ADD CONSTRAINT "rider_payouts_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_payouts" ADD CONSTRAINT "rider_payouts_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_payouts" ADD CONSTRAINT "rider_payouts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_payouts" ADD CONSTRAINT "rider_payouts_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_service_townships" ADD CONSTRAINT "rider_service_townships_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rider_service_townships" ADD CONSTRAINT "rider_service_townships_township_id_townships_id_fk" FOREIGN KEY ("township_id") REFERENCES "public"."townships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riders" ADD CONSTRAINT "riders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_impersonated_by_user_id_fk" FOREIGN KEY ("impersonated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_idx" ON "user" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "user_phone_number_idx" ON "user" USING btree ("phone_number");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_settlements_settlement_code_idx" ON "merchant_settlements" USING btree ("settlement_code");--> statement-breakpoint
CREATE UNIQUE INDEX "parcels_parcel_code_idx" ON "parcels" USING btree ("parcel_code");--> statement-breakpoint
CREATE UNIQUE INDEX "rider_payouts_payout_code_idx" ON "rider_payouts" USING btree ("payout_code");--> statement-breakpoint
CREATE UNIQUE INDEX "rider_service_townships_rider_township_idx" ON "rider_service_townships" USING btree ("rider_id","township_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");