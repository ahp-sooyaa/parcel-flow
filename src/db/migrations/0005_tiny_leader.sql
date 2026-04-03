CREATE TABLE IF NOT EXISTS "townships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "townships_name_uidx" ON "townships" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "townships_active_idx" ON "townships" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "townships_created_at_idx" ON "townships" USING btree ("created_at");--> statement-breakpoint

-- Rebuild merchant and rider tables from scratch for the new 1:1 profile model.
-- This change intentionally assumes there is no existing production data to preserve.
DROP POLICY IF EXISTS merchants_select_admin_or_self ON public.merchants;
DROP POLICY IF EXISTS merchants_insert_admin_only ON public.merchants;
DROP POLICY IF EXISTS merchants_update_admin_only ON public.merchants;
DROP POLICY IF EXISTS merchants_delete_super_admin_only ON public.merchants;
--> statement-breakpoint
DROP POLICY IF EXISTS riders_select_admin_or_self ON public.riders;
DROP POLICY IF EXISTS riders_insert_admin_only ON public.riders;
DROP POLICY IF EXISTS riders_update_admin_only ON public.riders;
DROP POLICY IF EXISTS riders_delete_super_admin_only ON public.riders;
--> statement-breakpoint

DROP TABLE IF EXISTS "merchants";
--> statement-breakpoint
CREATE TABLE "merchants" (
	"app_user_id" uuid PRIMARY KEY NOT NULL,
	"shop_name" text NOT NULL,
	"pickup_township_id" uuid,
	"default_pickup_address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_app_user_id_app_users_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "merchants_pickup_township_id_townships_id_fk" FOREIGN KEY ("pickup_township_id") REFERENCES "public"."townships"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "merchants_shop_name_idx" ON "merchants" USING btree ("shop_name");--> statement-breakpoint
CREATE INDEX "merchants_pickup_township_idx" ON "merchants" USING btree ("pickup_township_id");--> statement-breakpoint
CREATE INDEX "merchants_created_at_idx" ON "merchants" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY merchants_select_admin_or_self
ON public.merchants
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR public.is_office_admin()
  OR EXISTS (
    SELECT 1
    FROM public.app_users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.supabase_user_id = auth.uid()
      AND u.is_active = true
      AND r.slug = 'merchant'
      AND u.id = app_user_id
  )
);
--> statement-breakpoint
CREATE POLICY merchants_insert_admin_only
ON public.merchants
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_office_admin()
);
--> statement-breakpoint
CREATE POLICY merchants_update_admin_only
ON public.merchants
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR public.is_office_admin()
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_office_admin()
);
--> statement-breakpoint
CREATE POLICY merchants_delete_super_admin_only
ON public.merchants
FOR DELETE
TO authenticated
USING (public.is_super_admin());
--> statement-breakpoint

DROP TABLE IF EXISTS "riders";
--> statement-breakpoint
CREATE TABLE "riders" (
	"app_user_id" uuid PRIMARY KEY NOT NULL,
	"township_id" uuid,
	"vehicle_type" text DEFAULT 'bike' NOT NULL,
	"license_plate" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "riders_app_user_id_app_users_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "riders_township_id_townships_id_fk" FOREIGN KEY ("township_id") REFERENCES "public"."townships"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "riders_township_idx" ON "riders" USING btree ("township_id");--> statement-breakpoint
CREATE INDEX "riders_vehicle_type_idx" ON "riders" USING btree ("vehicle_type");--> statement-breakpoint
CREATE INDEX "riders_active_idx" ON "riders" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "riders_created_at_idx" ON "riders" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY riders_select_admin_or_self
ON public.riders
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR public.is_office_admin()
  OR EXISTS (
    SELECT 1
    FROM public.app_users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.supabase_user_id = auth.uid()
      AND u.is_active = true
      AND r.slug = 'rider'
      AND u.id = app_user_id
  )
);
--> statement-breakpoint
CREATE POLICY riders_insert_admin_only
ON public.riders
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR public.is_office_admin()
);
--> statement-breakpoint
CREATE POLICY riders_update_admin_only
ON public.riders
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR public.is_office_admin()
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_office_admin()
);
--> statement-breakpoint
CREATE POLICY riders_delete_super_admin_only
ON public.riders
FOR DELETE
TO authenticated
USING (public.is_super_admin());
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.townships, public.merchants, public.riders
TO authenticated, service_role;
