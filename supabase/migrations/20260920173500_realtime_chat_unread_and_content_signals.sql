-- Realtime chat receipts, unread counters, and public-safe Home-strip invalidation.
-- Keeps counters server authoritative so every client/device sees the same value.

alter table public.direct_conversations
  add column if not exists participant_low_unread_count integer not null default 0 check (participant_low_unread_count >= 0),
  add column if not exists participant_high_unread_count integer not null default 0 check (participant_high_unread_count >= 0),
  add column if not exists participant_low_last_read_at timestamptz,
  add column if not exists participant_high_last_read_at timestamptz;

alter table public.expression_memberships
  add column if not exists chat_unread_count integer not null default 0 check (chat_unread_count >= 0),
  add column if not exists chat_last_read_at timestamptz;

alter table public.group_memberships
  add column if not exists chat_unread_count integer not null default 0 check (chat_unread_count >= 0),
  add column if not exists chat_last_read_at timestamptz;

alter table public.group_chat_section_members
  add column if not exists unread_count integer not null default 0 check (unread_count >= 0),
  add column if not exists last_read_at timestamptz;

create or replace function public.bump_direct_chat_unread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.direct_conversations
  set
    participant_low_unread_count = case
      when new.sender_profile_id = participant_high then participant_low_unread_count + 1
      else participant_low_unread_count
    end,
    participant_high_unread_count = case
      when new.sender_profile_id = participant_low then participant_high_unread_count + 1
      else participant_high_unread_count
    end,
    updated_at = greatest(coalesce(updated_at, new.sent_at), new.sent_at)
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists direct_messages_unread_after_insert on public.direct_messages;
create trigger direct_messages_unread_after_insert
after insert on public.direct_messages
for each row execute function public.bump_direct_chat_unread();

create or replace function public.bump_expression_chat_unread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.expression_memberships
  set chat_unread_count = chat_unread_count + 1
  where organization_id = new.organization_id
    and branch_id = new.branch_id
    and status = 'active'
    and chat_banned_at is null
    and profile_id <> new.sender_profile_id;
  return new;
end;
$$;

drop trigger if exists expression_chat_unread_after_insert on public.expression_chat_messages;
create trigger expression_chat_unread_after_insert
after insert on public.expression_chat_messages
for each row execute function public.bump_expression_chat_unread();

create or replace function public.bump_group_chat_unread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.section_id is null then
    update public.group_memberships gm
    set chat_unread_count = gm.chat_unread_count + 1
    from public.memberships m
    where gm.group_id = new.group_id
      and gm.organization_id = new.organization_id
      and gm.status = 'active'
      and gm.banned_at is null
      and m.id = gm.membership_id
      and m.organization_id = gm.organization_id
      and m.profile_id <> new.sender_profile_id;
  else
    update public.group_chat_section_members gsm
    set unread_count = gsm.unread_count + 1
    from public.group_memberships gm
    join public.memberships m
      on m.id = gm.membership_id
     and m.organization_id = gm.organization_id
    where gsm.section_id = new.section_id
      and gsm.group_id = new.group_id
      and gsm.organization_id = new.organization_id
      and gm.id = gsm.group_membership_id
      and gm.status = 'active'
      and gm.banned_at is null
      and m.profile_id <> new.sender_profile_id;
  end if;
  return new;
end;
$$;

drop trigger if exists group_messages_unread_after_insert on public.group_messages;
create trigger group_messages_unread_after_insert
after insert on public.group_messages
for each row execute function public.bump_group_chat_unread();

-- Announcements were the main requested content type still outside the
-- publication. Add it without disturbing deployments where it is already present.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
end $$;

-- General Home notices are fetched through a server function because drafts are
-- private. A tiny public signal table carries no notice content and lets every
-- client invalidate/re-fetch the safe published strip immediately.
create table if not exists public.general_home_notice_signals (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  changed_at timestamptz not null default now()
);

alter table public.general_home_notice_signals enable row level security;

drop policy if exists general_home_notice_signals_read on public.general_home_notice_signals;
create policy general_home_notice_signals_read
on public.general_home_notice_signals
for select
to anon, authenticated
using (true);

grant select on public.general_home_notice_signals to anon, authenticated;

create or replace function public.signal_general_home_notice_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
begin
  target_org := coalesce(new.organization_id, old.organization_id);
  insert into public.general_home_notice_signals(organization_id, changed_at)
  values(target_org, now())
  on conflict (organization_id)
  do update set changed_at = excluded.changed_at;
  return coalesce(new, old);
end;
$$;

drop trigger if exists general_home_notices_realtime_signal on public.general_home_notices;
create trigger general_home_notices_realtime_signal
after insert or update or delete on public.general_home_notices
for each row execute function public.signal_general_home_notice_change();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'general_home_notice_signals'
  ) then
    alter publication supabase_realtime add table public.general_home_notice_signals;
  end if;
end $$;

create index if not exists direct_conversations_unread_low_idx
  on public.direct_conversations(participant_low, participant_low_unread_count)
  where participant_low_unread_count > 0;
create index if not exists direct_conversations_unread_high_idx
  on public.direct_conversations(participant_high, participant_high_unread_count)
  where participant_high_unread_count > 0;
create index if not exists expression_memberships_chat_unread_idx
  on public.expression_memberships(profile_id, branch_id, chat_unread_count)
  where status='active' and chat_unread_count > 0;
create index if not exists group_memberships_chat_unread_idx
  on public.group_memberships(membership_id, group_id, chat_unread_count)
  where status='active' and chat_unread_count > 0;
