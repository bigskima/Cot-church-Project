-- Read-only Level-1 identity directory. This intentionally exposes only account
-- governance metadata, not tenant pastoral/member-private records.

create or replace function public.platform_identity_directory(
  query_text text default null,
  page_size integer default 30,
  page_offset integer default 0
)
returns table (
  id uuid,
  email text,
  phone text,
  display_name text,
  avatar_url text,
  account_status text,
  banned_until timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  platform_roles text[],
  organization_memberships bigint,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with authorized as (
    select public.has_platform_permission('platform.users.read') as allowed
  ), filtered as (
    select
      u.id,
      u.email::text,
      u.phone::text,
      p.display_name,
      p.avatar_url,
      case when u.banned_until is not null and u.banned_until > now() then 'banned' else 'active' end as account_status,
      u.banned_until,
      u.last_sign_in_at,
      u.created_at,
      coalesce((
        select array_agg(pra.role_code order by pra.role_code)
        from public.platform_role_assignments pra
        where pra.profile_id = u.id
          and (pra.expires_at is null or pra.expires_at > now())
      ), array[]::text[]) as platform_roles,
      (select count(*) from public.memberships m where m.profile_id = u.id) as organization_memberships
    from auth.users u
    left join public.profiles p on p.id = u.id
    cross join authorized a
    where a.allowed
      and (
        nullif(trim(coalesce(query_text, '')), '') is null
        or coalesce(u.email, '') ilike '%' || trim(query_text) || '%'
        or coalesce(u.phone, '') ilike '%' || trim(query_text) || '%'
        or coalesce(p.display_name, '') ilike '%' || trim(query_text) || '%'
      )
  )
  select
    f.id,
    f.email,
    f.phone,
    f.display_name,
    f.avatar_url,
    f.account_status,
    f.banned_until,
    f.last_sign_in_at,
    f.created_at,
    f.platform_roles,
    f.organization_memberships,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc
  limit least(greatest(page_size, 1), 100)
  offset greatest(page_offset, 0);
$$;

revoke all on function public.platform_identity_directory(text, integer, integer) from public;
grant execute on function public.platform_identity_directory(text, integer, integer) to authenticated;

comment on function public.platform_identity_directory(text, integer, integer) is
  'Level-1 account governance directory. Requires platform.users.read and excludes tenant-private pastoral data.';
