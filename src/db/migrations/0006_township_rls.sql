ALTER TABLE public.townships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS townships_select_authenticated ON public.townships;
DROP POLICY IF EXISTS townships_insert_authenticated ON public.townships;
DROP POLICY IF EXISTS townships_update_authenticated ON public.townships;
DROP POLICY IF EXISTS townships_delete_super_admin_only ON public.townships;
--> statement-breakpoint

CREATE POLICY townships_select_authenticated
ON public.townships
FOR SELECT
TO authenticated
USING (true);
--> statement-breakpoint

CREATE POLICY townships_insert_authenticated
ON public.townships
FOR INSERT
TO authenticated
WITH CHECK (true);
--> statement-breakpoint

CREATE POLICY townships_update_authenticated
ON public.townships
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
--> statement-breakpoint

CREATE POLICY townships_delete_super_admin_only
ON public.townships
FOR DELETE
TO authenticated
USING (public.is_super_admin());
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.townships
TO authenticated, service_role;
