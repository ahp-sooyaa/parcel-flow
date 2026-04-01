-- =========================================
-- 0) Helpers: role checks
-- =========================================
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users u
    join public.roles r on r.id = u.role_id
    where u.supabase_user_id = auth.uid()
      and u.is_active = true
      and r.slug = 'super_admin'
  );
$$;

create or replace function public.is_office_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users u
    join public.roles r on r.id = u.role_id
    where u.supabase_user_id = auth.uid()
      and u.is_active = true
      and r.slug = 'office_admin'
  );
$$;

revoke all on function public.is_super_admin() from public;
revoke all on function public.is_office_admin() from public;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_office_admin() to authenticated;

-- =========================================
-- 1) Enable RLS
-- =========================================
alter table public.app_users enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.merchants enable row level security;

-- =========================================
-- 2) Cleanup old policies (if any)
-- =========================================
drop policy if exists app_users_select_own_or_super_admin on public.app_users;
drop policy if exists app_users_update_own_or_super_admin on public.app_users;
drop policy if exists app_users_delete_super_admin_only on public.app_users;
drop policy if exists app_users_insert_super_admin_only on public.app_users;

drop policy if exists roles_select_authenticated on public.roles;
drop policy if exists roles_write_super_admin_only on public.roles;

drop policy if exists permissions_select_authenticated on public.permissions;
drop policy if exists permissions_write_super_admin_only on public.permissions;

drop policy if exists role_permissions_select_authenticated on public.role_permissions;
drop policy if exists role_permissions_write_super_admin_only on public.role_permissions;

drop policy if exists merchants_select_admin_or_self on public.merchants;
drop policy if exists merchants_insert_admin_only on public.merchants;
drop policy if exists merchants_update_admin_only on public.merchants;
drop policy if exists merchants_delete_super_admin_only on public.merchants;

-- =========================================
-- 3) app_users policies
-- =========================================
create policy app_users_select_own_or_super_admin
on public.app_users
for select
to authenticated
using (
  supabase_user_id = auth.uid()
  or public.is_super_admin()
);

create policy app_users_update_own_or_super_admin
on public.app_users
for update
to authenticated
using (
  supabase_user_id = auth.uid()
  or public.is_super_admin()
)
with check (
  supabase_user_id = auth.uid()
  or public.is_super_admin()
);

create policy app_users_delete_super_admin_only
on public.app_users
for delete
to authenticated
using (public.is_super_admin());

create policy app_users_insert_super_admin_only
on public.app_users
for insert
to authenticated
with check (public.is_super_admin());

-- =========================================
-- 4) roles policies
-- =========================================
create policy roles_select_authenticated
on public.roles
for select
to authenticated
using (true);

create policy roles_write_super_admin_only
on public.roles
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- =========================================
-- 5) permissions policies
-- =========================================
create policy permissions_select_authenticated
on public.permissions
for select
to authenticated
using (true);

create policy permissions_write_super_admin_only
on public.permissions
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- =========================================
-- 6) role_permissions policies
-- =========================================
create policy role_permissions_select_authenticated
on public.role_permissions
for select
to authenticated
using (true);

create policy role_permissions_write_super_admin_only
on public.role_permissions
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- =========================================
-- 7) merchants policies
-- =========================================
create policy merchants_select_admin_or_self
on public.merchants
for select
to authenticated
using (
  public.is_super_admin()
  or public.is_office_admin()
  or exists (
    select 1
    from public.app_users u
    join public.roles r on r.id = u.role_id
    where u.supabase_user_id = auth.uid()
      and u.is_active = true
      and r.slug = 'merchant'
      and u.id = linked_app_user_id
  )
);

create policy merchants_insert_admin_only
on public.merchants
for insert
to authenticated
with check (
  public.is_super_admin()
  or public.is_office_admin()
);

create policy merchants_update_admin_only
on public.merchants
for update
to authenticated
using (
  public.is_super_admin()
  or public.is_office_admin()
)
with check (
  public.is_super_admin()
  or public.is_office_admin()
);

create policy merchants_delete_super_admin_only
on public.merchants
for delete
to authenticated
using (public.is_super_admin());

-- =========================================
-- 8) Schema and object grants for Supabase roles
-- =========================================
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete
on all tables in schema public
to authenticated, service_role;

grant usage, select
on all sequences in schema public
to authenticated, service_role;

grant execute
on all functions in schema public
to authenticated, service_role;
