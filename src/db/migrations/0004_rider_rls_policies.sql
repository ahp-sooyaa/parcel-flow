-- Custom SQL migration file, put your code below! --
-- =========================================
-- Riders RLS + policies (mirrors merchants)
-- =========================================

alter table public.riders enable row level security;

drop policy if exists riders_select_admin_or_self on public.riders;
drop policy if exists riders_insert_admin_only on public.riders;
drop policy if exists riders_update_admin_only on public.riders;
drop policy if exists riders_delete_super_admin_only on public.riders;

create policy riders_select_admin_or_self
on public.riders
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
      and r.slug = 'rider'
      and u.id = linked_app_user_id
  )
);

create policy riders_insert_admin_only
on public.riders
for insert
to authenticated
with check (
  public.is_super_admin()
  or public.is_office_admin()
);

create policy riders_update_admin_only
on public.riders
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

create policy riders_delete_super_admin_only
on public.riders
for delete
to authenticated
using (public.is_super_admin());
