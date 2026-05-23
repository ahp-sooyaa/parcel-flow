ALTER TABLE "merchant_settlements" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
UPDATE "merchant_settlements" SET "status" = 'pending' WHERE "status" = 'in_progress';--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD COLUMN "bank_transfer_receipt_key" text;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD COLUMN "bank_transfer_receipt_uploaded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD COLUMN "bank_transfer_receipt_uploaded_by" uuid;--> statement-breakpoint
ALTER TABLE "merchant_settlements" ADD CONSTRAINT "merchant_settlements_bank_transfer_receipt_uploaded_by_user_id_fk" FOREIGN KEY ("bank_transfer_receipt_uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
