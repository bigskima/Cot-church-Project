alter table public.prayer_requests
  add column if not exists prayer_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'prayer_requests_prayer_count_nonnegative'
      and conrelid = 'public.prayer_requests'::regclass
  ) then
    alter table public.prayer_requests
      add constraint prayer_requests_prayer_count_nonnegative
      check (prayer_count >= 0);
  end if;
end $$;

create table if not exists public.prayer_supports (
  prayer_request_id uuid not null references public.prayer_requests(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (prayer_request_id, profile_id)
);

alter table public.prayer_supports enable row level security;
revoke all on table public.prayer_supports from anon, authenticated;
grant select, insert, delete on table public.prayer_supports to service_role;

create index if not exists prayer_supports_profile_idx
  on public.prayer_supports(profile_id, created_at desc);

create or replace function public.sync_prayer_support_count()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.prayer_requests
    set prayer_count = prayer_count + 1
    where id = new.prayer_request_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.prayer_requests
    set prayer_count = greatest(prayer_count - 1, 0)
    where id = old.prayer_request_id;
    return old;
  end if;

  return null;
end;
$$;

revoke all on function public.sync_prayer_support_count() from public, anon, authenticated;

drop trigger if exists prayer_supports_sync_count on public.prayer_supports;
create trigger prayer_supports_sync_count
after insert or delete on public.prayer_supports
for each row execute function public.sync_prayer_support_count();

update public.prayer_requests p
set prayer_count = counts.total
from (
  select prayer_request_id, count(*)::integer as total
  from public.prayer_supports
  group by prayer_request_id
) counts
where p.id = counts.prayer_request_id
  and p.prayer_count is distinct from counts.total;
