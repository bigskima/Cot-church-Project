-- Expression birthday privacy and automatic local-time reminders.
-- Full birthday dates remain private profile data. Expression readers receive only month/day.

alter table public.profiles
  add column if not exists birthday_expression_visible boolean not null default true;

create or replace function public.birthday_occurrence(source_birthday date, target_year integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(
    target_year,
    extract(month from source_birthday)::integer,
    least(
      extract(day from source_birthday)::integer,
      extract(day from (
        date_trunc('month', make_date(target_year, extract(month from source_birthday)::integer, 1)::timestamp)
        + interval '1 month - 1 day'
      ))::integer
    )
  );
$$;

create or replace function public.expression_birthdays(
  target_organization_id uuid,
  target_branch_id uuid,
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
  branch_timezone text;
  local_today date;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if days_ahead < 0 or days_ahead > 366 then
    raise exception using errcode = '22023', message = 'days_ahead must be between 0 and 366';
  end if;

  select b.timezone into branch_timezone
  from public.branches b
  where b.id = target_branch_id
    and b.organization_id = target_organization_id
    and b.is_active;
  if branch_timezone is null then
    raise exception using errcode = 'P0002', message = 'Expression not found';
  end if;

  if not public.is_expression_member(target_organization_id, target_branch_id)
     and not public.has_permission(target_organization_id, 'members.read', target_branch_id) then
    raise exception using errcode = '42501', message = 'Expression membership required';
  end if;

  local_today := (now() at time zone branch_timezone)::date;

  return query
  with eligible as (
    select
      p.id,
      p.display_name,
      p.username,
      p.avatar_url,
      p.birthday,
      public.birthday_occurrence(p.birthday, extract(year from local_today)::integer) as this_year
    from public.memberships m
    join public.profiles p on p.id = m.profile_id
    where m.organization_id = target_organization_id
      and m.branch_id = target_branch_id
      and m.status = 'active'
      and p.birthday is not null
      and p.birthday_expression_visible
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

create or replace function public.enqueue_expression_birthday_notifications(reference_time timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  with birthday_people as (
    select
      b.organization_id,
      b.id as branch_id,
      b.name as branch_name,
      (reference_time at time zone b.timezone)::date as local_date,
      p.id as birthday_profile_id,
      p.display_name,
      extract(month from p.birthday)::integer as birthday_month,
      extract(day from p.birthday)::integer as birthday_day
    from public.branches b
    join public.memberships birthday_membership
      on birthday_membership.organization_id = b.organization_id
     and birthday_membership.branch_id = b.id
     and birthday_membership.status = 'active'
    join public.profiles p on p.id = birthday_membership.profile_id
    where b.is_active
      and p.birthday is not null
      and p.birthday_expression_visible
      and extract(month from p.birthday)::integer = extract(month from (reference_time at time zone b.timezone)::date)::integer
      and extract(day from p.birthday)::integer = extract(day from (reference_time at time zone b.timezone)::date)::integer
  ), recipients as (
    select
      bp.*,
      recipient.profile_id as recipient_profile_id
    from birthday_people bp
    join public.memberships recipient
      on recipient.organization_id = bp.organization_id
     and recipient.branch_id = bp.branch_id
     and recipient.status = 'active'
  )
  insert into public.notifications(
    organization_id,
    recipient_profile_id,
    type,
    title,
    body,
    data
  )
  select
    r.organization_id,
    r.recipient_profile_id,
    'expression_birthday:' || r.birthday_profile_id::text || ':' || to_char(r.local_date, 'YYYYMMDD'),
    case when r.recipient_profile_id = r.birthday_profile_id
      then 'Happy Birthday!'
      else 'Birthday today · ' || r.branch_name
    end,
    case when r.recipient_profile_id = r.birthday_profile_id
      then 'Your Expression is celebrating with you today. Happy birthday, ' || r.display_name || '!'
      else r.display_name || ' is celebrating a birthday today.'
    end,
    jsonb_build_object(
      'kind', 'expression_birthday',
      'branchId', r.branch_id,
      'birthdayProfileId', r.birthday_profile_id,
      'birthdayMonth', r.birthday_month,
      'birthdayDay', r.birthday_day,
      'localDate', r.local_date
    )
  from recipients r
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.birthday_occurrence(date,integer) from public;
revoke all on function public.expression_birthdays(uuid,uuid,integer) from public;
revoke all on function public.enqueue_expression_birthday_notifications(timestamptz) from public;
grant execute on function public.expression_birthdays(uuid,uuid,integer) to authenticated;
grant execute on function public.enqueue_expression_birthday_notifications(timestamptz) to service_role;

create extension if not exists pg_cron;
select cron.schedule(
  'expression-birthday-reminders',
  '5 * * * *',
  $cron$select public.enqueue_expression_birthday_notifications(now());$cron$
);
