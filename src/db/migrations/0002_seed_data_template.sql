-- =========================================
-- Auth Foundation Seed Data
-- =========================================
-- Source of truth for initial role / permission / role_permission data.
-- Idempotent and safe to re-run.

drop table if exists pg_temp.seed_roles;
create temporary table seed_roles (
  slug text primary key,
  label text not null
) on commit drop;

insert into seed_roles (slug, label)
values
  ('super_admin', 'Super Admin'),
  ('office_admin', 'Office Admin'),
  ('rider', 'Rider'),
  ('merchant', 'Merchant');

drop table if exists pg_temp.seed_permissions;
create temporary table seed_permissions (
  slug text primary key,
  label text not null
) on commit drop;

insert into seed_permissions (slug, label)
values
  ('dashboard-page.view', 'View dashboard page'),
  ('user-password.reset', 'Reset user password'),
  ('user-list.view', 'View user list'),
  ('user.view', 'View user details'),
  ('user.create', 'Create user'),
  ('user.update', 'Update user'),
  ('user.delete', 'Delete user'),
  ('township-list.view', 'View township list'),
  ('township.create', 'Create township'),
  ('township.update', 'Update township'),
  ('township.delete', 'Delete township'),
  ('merchant-list.view', 'View merchant list'),
  ('merchant.view', 'View merchant details'),
  ('merchant.update', 'Update merchant'),
  ('merchant.delete', 'Delete merchant'),
  ('rider-list.view', 'View rider list'),
  ('rider.view', 'View rider details'),
  ('rider.update', 'Update rider'),
  ('rider.delete', 'Delete rider'),
  ('parcel-list.view', 'View parcel list'),
  ('parcel.view', 'View parcel details'),
  ('parcel.create', 'Create parcel'),
  ('parcel.update', 'Update parcel'),
  ('parcel.delete', 'Delete parcel');

drop table if exists pg_temp.seed_office_admin_denied_permissions;
create temporary table seed_office_admin_denied_permissions (
  permission_slug text primary key
) on commit drop;

insert into seed_office_admin_denied_permissions (permission_slug)
values
  ('user-password.reset'),
  ('user.delete'),
  ('township.create'),
  ('township.delete'),
  ('merchant.delete'),
  ('rider.delete'),
  ('parcel.delete');

drop table if exists pg_temp.seed_rider_allowed_permissions;
create temporary table seed_rider_allowed_permissions (
  permission_slug text primary key
) on commit drop;

drop table if exists pg_temp.seed_merchant_allowed_permissions;
create temporary table seed_merchant_allowed_permissions (
  permission_slug text primary key
) on commit drop;

insert into seed_merchant_allowed_permissions (permission_slug)
values
  ('parcel.create');

drop table if exists pg_temp.seed_essential_permissions;
create temporary table seed_essential_permissions (
  permission_slug text primary key
) on commit drop;

insert into seed_essential_permissions (permission_slug)
values
  ('dashboard-page.view');

insert into public.roles (slug, label)
select slug, label
from seed_roles
on conflict (slug) do update
set label = excluded.label;

drop table if exists pg_temp.seed_role_ids;
create temporary table seed_role_ids (
  role_slug text primary key,
  role_id uuid not null
) on commit drop;

insert into seed_role_ids (role_slug, role_id)
select r.slug, r.id
from public.roles r
join seed_roles sr on sr.slug = r.slug;

insert into public.permissions (slug, label)
select slug, label
from seed_permissions
on conflict (slug) do update
set label = excluded.label;

-- Remove legacy permissions that are no longer in code constants.
delete from public.permissions p
where not exists (
  select 1
  from seed_permissions sp
  where sp.slug = p.slug
);

drop table if exists pg_temp.seed_role_permission_ids;
create temporary table seed_role_permission_ids (
  role_id uuid not null,
  permission_id uuid not null,
  primary key (role_id, permission_id)
) on commit drop;

insert into seed_role_permission_ids (role_id, permission_id)
select sri.role_id, p.id
from seed_role_ids sri
join public.permissions p on true
where sri.role_slug = 'super_admin'

union

select sri.role_id, p.id
from seed_role_ids sri
join public.permissions p on true
left join seed_office_admin_denied_permissions denied on denied.permission_slug = p.slug
where sri.role_slug = 'office_admin'
  and denied.permission_slug is null

union

select sri.role_id, p.id
from seed_role_ids sri
join seed_rider_allowed_permissions allowed on true
join public.permissions p on p.slug = allowed.permission_slug
where sri.role_slug = 'rider'

union

select sri.role_id, p.id
from seed_role_ids sri
join seed_merchant_allowed_permissions allowed on true
join public.permissions p on p.slug = allowed.permission_slug
where sri.role_slug = 'merchant'

union

select sri.role_id, p.id
from seed_role_ids sri
join seed_essential_permissions essential on true
join public.permissions p on p.slug = essential.permission_slug;

insert into public.role_permissions (role_id, permission_id)
select role_id, permission_id
from seed_role_permission_ids
on conflict (role_id, permission_id) do nothing;

-- Remove stale permission links that no longer match the role matrix.
delete from public.role_permissions rp
where not exists (
  select 1
  from seed_role_permission_ids di
  where di.role_id = rp.role_id
    and di.permission_id = rp.permission_id
);
