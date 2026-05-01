ALTER TABLE "merchant_pickup_locations" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "merchant_pickup_locations" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "merchant_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "pickup_contact_name" text;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "pickup_contact_phone" text;--> statement-breakpoint
ALTER TABLE "parcels" ADD COLUMN "recipient_contact_label" text;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_merchant_contact_id_merchant_contacts_id_fk" FOREIGN KEY ("merchant_contact_id") REFERENCES "public"."merchant_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parcels_merchant_contact_idx" ON "parcels" USING btree ("merchant_contact_id");