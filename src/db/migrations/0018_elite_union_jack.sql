CREATE TABLE "merchant_pickup_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"label" text NOT NULL,
	"normalized_label" text NOT NULL,
	"township_id" uuid NOT NULL,
	"pickup_address" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "pickup_location_id" uuid;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "pickup_township_id" uuid;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "pickup_location_label" text;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "pickup_address" text;--> statement-breakpoint
ALTER TABLE "merchant_pickup_locations" ADD CONSTRAINT "merchant_pickup_locations_merchant_id_merchants_app_user_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("app_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_pickup_locations" ADD CONSTRAINT "merchant_pickup_locations_township_id_townships_id_fk" FOREIGN KEY ("township_id") REFERENCES "public"."townships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_pickup_locations_merchant_idx" ON "merchant_pickup_locations" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_pickup_locations_township_idx" ON "merchant_pickup_locations" USING btree ("township_id");--> statement-breakpoint
CREATE INDEX "merchant_pickup_locations_merchant_label_idx" ON "merchant_pickup_locations" USING btree ("merchant_id","normalized_label");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_pickup_locations_merchant_label_uidx" ON "merchant_pickup_locations" USING btree ("merchant_id","normalized_label");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_pickup_locations_default_uidx" ON "merchant_pickup_locations" USING btree ("merchant_id") WHERE "merchant_pickup_locations"."is_default" = true;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_pickup_location_id_merchant_pickup_locations_id_fk" FOREIGN KEY ("pickup_location_id") REFERENCES "public"."merchant_pickup_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_pickup_township_id_townships_id_fk" FOREIGN KEY ("pickup_township_id") REFERENCES "public"."townships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parcels_pickup_location_idx" ON "parcels" USING btree ("pickup_location_id");--> statement-breakpoint
CREATE INDEX "parcels_pickup_township_idx" ON "parcels" USING btree ("pickup_township_id");