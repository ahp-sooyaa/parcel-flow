ALTER TABLE "parcels"
ALTER COLUMN "delivery_failure_note"
SET DATA TYPE jsonb
USING (
  CASE
    WHEN "delivery_failure_note" IS NULL OR btrim("delivery_failure_note") = '' THEN NULL
    WHEN "status" = 'on_the_way' AND "rider_id" IS NOT NULL THEN jsonb_build_array(
      jsonb_build_object('note', "delivery_failure_note", 'status', 'active')
    )
    ELSE jsonb_build_array(
      jsonb_build_object('note', "delivery_failure_note", 'status', 'inactive')
    )
  END
);
