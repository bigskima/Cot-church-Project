-- Public/general birthday directory is separate from Expression birthday visibility.
-- Full dates of birth remain private. Public consumers receive month/day and the
-- next occurrence only when a user has explicitly opted into public visibility.

alter table public.profiles
  add column if not exists birthday_public_visible boolean not null default false;

create or replace function public.public_birthdays(
  target_organization_id uuid,
  days_ahead integer default 60
)
returns table(
  profile_id uuid,
  display_name text,
  username text,
  avatar_url text,
  birthday_month integer,
  birthday_day integer,
  next_birthday date,
  days_until integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  organization_timezone text;
  local_today date;
begin
  if target_organization_id is null then
    raise exception using errcode = '22023', message = 'organizationId is required';
  end if;
  if days_ahead < 0 or days_ahead > 366 then
    raise exception using errcode = '22023', message = 'days_ahead must be between 0 and 366';
  end if;

  select o.timezone into organization_timezone
  from public.organizations o
  where o.id = target_organization_id
    and o.status = 'active';

  if organization_timezone is null then
    raise exception using errcode = 'P0002', message = 'Church organization not found';
  end if;

  local_today := (now() at time zone organization_timezone)::date;

  return query
  with eligible as (
    select distinct on (p.id)
      p.id,
      p.display_name,
      p.username,
      p.avatar_url,
      p.birthday,
      public.birthday_occurrence(p.birthday, extract(year from local_today)::integer) as this_year
    from public.memberships m
    join public.profiles p on p.id = m.profile_id
    where m.organization_id = target_organization_id
      and m.status = 'active'
      and p.birthday is not null
      and p.birthday_public_visible
    order by p.id, m.created_at
  ), resolved as (
    select
      e.*,
      case
        when e.this_year >= local_today then e.this_year
        else public.birthday_occurrence(e.birthday, extract(year from local_today)::integer + 1)
      end as occurrence
    from eligible e
  )
  select
    r.id,
    r.display_name,
    r.username,
    r.avatar_url,
    extract(month from r.birthday)::integer,
    extract(day from r.birthday)::integer,
    r.occurrence,
    (r.occurrence - local_today)::integer
  from resolved r
  where r.occurrence <= local_today + days_ahead
  order by r.occurrence, lower(r.display_name), r.id;
end;
$$;

revoke all on function public.public_birthdays(uuid,integer) from public;
grant execute on function public.public_birthdays(uuid,integer) to anon, authenticated;

comment on column public.profiles.birthday_public_visible is
  'Explicit opt-in for showing birthday month/day in the public/general community. Independent of Expression birthday visibility.';
comment on function public.public_birthdays(uuid,integer) is
  'Returns privacy-safe upcoming public birthdays for one active church organization; never exposes full birth dates or years.';
