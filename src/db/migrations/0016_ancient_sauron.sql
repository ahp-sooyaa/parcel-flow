CREATE TABLE "delivery_pricing_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"township_id" uuid NOT NULL,
	"merchant_id" uuid,
	"base_weight_kg" numeric(12, 2) NOT NULL,
	"base_fee" numeric(12, 2) NOT NULL,
	"extra_weight_unit_kg" numeric(12, 2) NOT NULL,
	"extra_weight_fee" numeric(12, 2) NOT NULL,
	"volumetric_divisor" integer DEFAULT 5000 NOT NULL,
	"cod_fee_percent" numeric(8, 4) DEFAULT '0' NOT NULL,
	"return_fee_percent" numeric(8, 4) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_pricing_rates_base_weight_positive" CHECK ("delivery_pricing_rates"."base_weight_kg" > 0),
	CONSTRAINT "delivery_pricing_rates_base_fee_non_negative" CHECK ("delivery_pricing_rates"."base_fee" >= 0),
	CONSTRAINT "delivery_pricing_rates_extra_weight_unit_positive" CHECK ("delivery_pricing_rates"."extra_weight_unit_kg" > 0),
	CONSTRAINT "delivery_pricing_rates_extra_weight_fee_non_negative" CHECK ("delivery_pricing_rates"."extra_weight_fee" >= 0),
	CONSTRAINT "delivery_pricing_rates_volumetric_divisor_positive" CHECK ("delivery_pricing_rates"."volumetric_divisor" > 0),
	CONSTRAINT "delivery_pricing_rates_cod_fee_percent_non_negative" CHECK ("delivery_pricing_rates"."cod_fee_percent" >= 0),
	CONSTRAINT "delivery_pricing_rates_return_fee_percent_non_negative" CHECK ("delivery_pricing_rates"."return_fee_percent" >= 0)
);
--> statement-breakpoint
ALTER TABLE "delivery_pricing_rates" ADD CONSTRAINT "delivery_pricing_rates_township_id_townships_id_fk" FOREIGN KEY ("township_id") REFERENCES "public"."townships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_pricing_rates" ADD CONSTRAINT "delivery_pricing_rates_merchant_id_merchants_app_user_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("app_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_pricing_rates_township_idx" ON "delivery_pricing_rates" USING btree ("township_id");--> statement-breakpoint
CREATE INDEX "delivery_pricing_rates_merchant_idx" ON "delivery_pricing_rates" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "delivery_pricing_rates_township_active_idx" ON "delivery_pricing_rates" USING btree ("township_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_pricing_rates_active_global_uidx" ON "delivery_pricing_rates" USING btree ("township_id") WHERE "delivery_pricing_rates"."merchant_id" is null and "delivery_pricing_rates"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_pricing_rates_active_merchant_uidx" ON "delivery_pricing_rates" USING btree ("township_id","merchant_id") WHERE "delivery_pricing_rates"."merchant_id" is not null and "delivery_pricing_rates"."is_active" = true;