ALTER TABLE "parcel_payment_records" ADD COLUMN "payment_slip_image_keys" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "parcel_description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "package_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "special_handling_note" text;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "estimated_weight_kg" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "package_width_cm" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "package_height_cm" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "package_length_cm" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "pickup_image_keys" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "proof_of_delivery_image_keys" jsonb DEFAULT '[]'::jsonb NOT NULL;