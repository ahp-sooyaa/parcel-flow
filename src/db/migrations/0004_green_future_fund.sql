-- Realtime scope for this change is intentionally limited to public.parcels.
-- Admin parcel summary cards and merchant overview cards can refresh from parcel invalidation
-- without publishing settlement or payout tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'parcels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "public"."parcels";
  END IF;
END $$;

ALTER TABLE "public"."parcels" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE "public"."parcels" TO authenticated;

DROP POLICY IF EXISTS "parcels_admin_select" ON "public"."parcels";
CREATE POLICY "parcels_admin_select"
ON "public"."parcels"
FOR SELECT
TO authenticated
USING (COALESCE(auth.jwt() ->> 'role', '') IN ('super_admin', 'office_admin'));

DROP POLICY IF EXISTS "parcels_merchant_select" ON "public"."parcels";
CREATE POLICY "parcels_merchant_select"
ON "public"."parcels"
FOR SELECT
TO authenticated
USING (
  COALESCE(auth.jwt() ->> 'role', '') = 'merchant'
  AND EXISTS (
    SELECT 1
    FROM "public"."merchants"
    WHERE "merchants"."id" = "parcels"."merchant_id"
      AND "merchants"."user_id" = auth.uid()
  )
);

DROP POLICY IF EXISTS "parcels_rider_select" ON "public"."parcels";
CREATE POLICY "parcels_rider_select"
ON "public"."parcels"
FOR SELECT
TO authenticated
USING (
  COALESCE(auth.jwt() ->> 'role', '') = 'rider'
  AND EXISTS (
    SELECT 1
    FROM "public"."riders"
    WHERE "riders"."id" = "parcels"."rider_id"
      AND "riders"."user_id" = auth.uid()
  )
);
