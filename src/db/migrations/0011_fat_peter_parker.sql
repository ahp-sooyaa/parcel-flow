CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_user_id" uuid,
	"bank_name" text NOT NULL,
	"bank_account_name" text NOT NULL,
	"bank_account_number" text NOT NULL,
	"is_company_account" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_accounts_owner_check" CHECK ((
                ("bank_accounts"."is_company_account" = true and "bank_accounts"."app_user_id" is null)
                or
                ("bank_accounts"."is_company_account" = false and "bank_accounts"."app_user_id" is not null)
            ))
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_app_user_id_app_users_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_accounts_app_user_idx" ON "bank_accounts" USING btree ("app_user_id");--> statement-breakpoint
CREATE INDEX "bank_accounts_company_idx" ON "bank_accounts" USING btree ("is_company_account");--> statement-breakpoint
CREATE INDEX "bank_accounts_created_at_idx" ON "bank_accounts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bank_accounts_deleted_at_idx" ON "bank_accounts" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_user_primary_uidx" ON "bank_accounts" USING btree ("app_user_id") WHERE "bank_accounts"."deleted_at" is null and "bank_accounts"."is_company_account" = false and "bank_accounts"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_company_primary_uidx" ON "bank_accounts" USING btree ("is_company_account") WHERE "bank_accounts"."deleted_at" is null and "bank_accounts"."is_company_account" = true and "bank_accounts"."is_primary" = true;--> statement-breakpoint
CREATE POLICY "bank_accounts_select_admin_or_owner" ON "bank_accounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
                public.is_super_admin()
                or public.is_office_admin()
                or (
                    "bank_accounts"."is_company_account" = false
                    and exists (
                        select 1
                        from public.app_users u
                        join public.roles r on r.id = u.role_id
                        where u.supabase_user_id = auth.uid()
                          and u.is_active = true
                          and u.deleted_at is null
                          and r.slug in ('merchant', 'rider')
                          and u.id = "bank_accounts"."app_user_id"
                    )
                )
            );--> statement-breakpoint
CREATE POLICY "bank_accounts_insert_super_admin_or_owner" ON "bank_accounts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
                public.is_super_admin()
                or (
                    "bank_accounts"."is_company_account" = false
                    and exists (
                        select 1
                        from public.app_users u
                        join public.roles r on r.id = u.role_id
                        where u.supabase_user_id = auth.uid()
                          and u.is_active = true
                          and u.deleted_at is null
                          and r.slug in ('merchant', 'rider')
                          and u.id = "bank_accounts"."app_user_id"
                    )
                )
            );--> statement-breakpoint
CREATE POLICY "bank_accounts_update_super_admin_or_owner" ON "bank_accounts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
                public.is_super_admin()
                or (
                    "bank_accounts"."is_company_account" = false
                    and exists (
                        select 1
                        from public.app_users u
                        join public.roles r on r.id = u.role_id
                        where u.supabase_user_id = auth.uid()
                          and u.is_active = true
                          and u.deleted_at is null
                          and r.slug in ('merchant', 'rider')
                          and u.id = "bank_accounts"."app_user_id"
                    )
                )
            ) WITH CHECK (
                public.is_super_admin()
                or (
                    "bank_accounts"."is_company_account" = false
                    and exists (
                        select 1
                        from public.app_users u
                        join public.roles r on r.id = u.role_id
                        where u.supabase_user_id = auth.uid()
                          and u.is_active = true
                          and u.deleted_at is null
                          and r.slug in ('merchant', 'rider')
                          and u.id = "bank_accounts"."app_user_id"
                    )
                )
            );--> statement-breakpoint
CREATE POLICY "bank_accounts_delete_super_admin_or_owner" ON "bank_accounts" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
                public.is_super_admin()
                or (
                    "bank_accounts"."is_company_account" = false
                    and exists (
                        select 1
                        from public.app_users u
                        join public.roles r on r.id = u.role_id
                        where u.supabase_user_id = auth.uid()
                          and u.is_active = true
                          and u.deleted_at is null
                          and r.slug in ('merchant', 'rider')
                          and u.id = "bank_accounts"."app_user_id"
                        )
                )
            );--> statement-breakpoint
INSERT INTO public.permissions (slug, label)
VALUES
  ('bank-account.view', 'View bank accounts'),
  ('bank-account.create', 'Create bank account'),
  ('bank-account.update', 'Update bank account'),
  ('bank-account.delete', 'Delete bank account')
ON CONFLICT (slug) DO UPDATE
SET
  label = EXCLUDED.label,
  updated_at = now();--> statement-breakpoint
WITH bank_account_role_permissions (role_slug, permission_slug) AS (
  VALUES
    ('super_admin', 'bank-account.view'),
    ('super_admin', 'bank-account.create'),
    ('super_admin', 'bank-account.update'),
    ('super_admin', 'bank-account.delete'),
    ('office_admin', 'bank-account.view')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM bank_account_role_permissions rp
JOIN public.roles r ON r.slug = rp.role_slug
JOIN public.permissions p ON p.slug = rp.permission_slug
ON CONFLICT (role_id, permission_id) DO NOTHING;
