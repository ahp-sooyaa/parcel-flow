-- Enable RLS across public domain tables as a Supabase defense-in-depth layer.
-- Server-side Drizzle access uses a privileged database role and is unchanged.
-- Direct PostgREST / Realtime access with anon or authenticated keys is denied by default.

CREATE OR REPLACE FUNCTION public.auth_jwt_role()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() ->> 'role', '');
$$;

CREATE OR REPLACE FUNCTION public.is_admin_auth_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.auth_jwt_role() IN ('super_admin', 'office_admin');
$$;

ALTER TABLE "public"."merchants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."riders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."townships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rider_service_townships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."financial_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."merchant_settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rider_payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."parcel_status_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."parcel_correction_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."verification" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."merchants" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."riders" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."townships" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."rider_service_townships" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."financial_items" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."bank_accounts" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."merchant_settlements" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."rider_payouts" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."parcel_status_logs" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."parcel_correction_logs" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."user" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."session" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."account" FROM anon, authenticated;
REVOKE ALL ON TABLE "public"."verification" FROM anon, authenticated;

GRANT SELECT ON TABLE "public"."merchants" TO authenticated;
GRANT SELECT ON TABLE "public"."riders" TO authenticated;

DROP POLICY IF EXISTS "merchants_admin_select" ON "public"."merchants";
CREATE POLICY "merchants_admin_select"
ON "public"."merchants"
FOR SELECT
TO authenticated
USING (public.is_admin_auth_role());

DROP POLICY IF EXISTS "merchants_self_select" ON "public"."merchants";
CREATE POLICY "merchants_self_select"
ON "public"."merchants"
FOR SELECT
TO authenticated
USING (
  public.auth_jwt_role() = 'merchant'
  AND "user_id" = auth.uid()
);

DROP POLICY IF EXISTS "riders_admin_select" ON "public"."riders";
CREATE POLICY "riders_admin_select"
ON "public"."riders"
FOR SELECT
TO authenticated
USING (public.is_admin_auth_role());

DROP POLICY IF EXISTS "riders_self_select" ON "public"."riders";
CREATE POLICY "riders_self_select"
ON "public"."riders"
FOR SELECT
TO authenticated
USING (
  public.auth_jwt_role() = 'rider'
  AND "user_id" = auth.uid()
);
