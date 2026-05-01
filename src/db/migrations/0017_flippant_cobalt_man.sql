CREATE TABLE "merchant_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"contact_label" text NOT NULL,
	"normalized_contact_label" text NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"recipient_township_id" uuid NOT NULL,
	"recipient_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchant_contacts" ADD CONSTRAINT "merchant_contacts_merchant_id_merchants_app_user_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("app_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_contacts" ADD CONSTRAINT "merchant_contacts_recipient_township_id_townships_id_fk" FOREIGN KEY ("recipient_township_id") REFERENCES "public"."townships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_contacts_merchant_idx" ON "merchant_contacts" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_contacts_recipient_township_idx" ON "merchant_contacts" USING btree ("recipient_township_id");--> statement-breakpoint
CREATE INDEX "merchant_contacts_merchant_label_idx" ON "merchant_contacts" USING btree ("merchant_id","normalized_contact_label");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_contacts_merchant_label_uidx" ON "merchant_contacts" USING btree ("merchant_id","normalized_contact_label");