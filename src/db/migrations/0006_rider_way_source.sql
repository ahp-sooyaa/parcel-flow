ALTER TABLE "financial_items" ADD COLUMN "rider_way_source" text;
--> statement-breakpoint
UPDATE "financial_items"
SET "rider_way_source" = 'legacy_delivery'
WHERE "item_type" = 'rider_way_payout'
  AND "rider_way_source" IS NULL;
