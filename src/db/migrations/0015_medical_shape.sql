ALTER TABLE "parcels" ALTER COLUMN "package_width_cm" SET DEFAULT '1.00';--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "package_width_cm" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "package_height_cm" SET DEFAULT '1.00';--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "package_height_cm" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "package_length_cm" SET DEFAULT '1.00';--> statement-breakpoint
ALTER TABLE "parcels" ALTER COLUMN "package_length_cm" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "is_large_item" boolean DEFAULT false NOT NULL;