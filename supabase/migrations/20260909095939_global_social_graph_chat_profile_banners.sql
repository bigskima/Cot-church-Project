-- Global social graph, profile banners, global one-to-one DMs, and group-scoped chat.
-- Direct messages are intentionally profile-scoped and independent of church/Expression membership.
-- Group chat remains a separate resource, authorized by active group membership.

alter table public.profiles
  add column if not exists banner_url text;

alter table public.follows
  add column if not exists target_profile_id uuid references public.profiles(id) on delete cascade;

alter table public.follows
  drop constraint if exists follows_check;

alter table public.follows
  add constraint follows_exactly_one_target_check
  check (num_nonnulls(organization_id, expression_id, leader_id, target_profile_id) = 1);

alter table public.follows
  drop constraint if exists follows_not_self_check;

alter table public.follows
  add constraint follows_not_self_check
  check (target_profile_id is null or target_profile_id <> profile_id);

create unique index if not exists follows_profile_target_profile_uidx
  on public.follows(profile_id, target_profile_id)
  where target_profile_id is not null;

create index if not exists follows_target_profile_idx
  on public.follows(target_profile_id)
  where target_profile_id is not null;

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  participant_low uuid not null references public.profiles(id) on delete cascade,
  participant_high uuid not null references public.profiles(id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint direct_conversations_distinct_participants_check check (participant_low <> participant_high),
  constraint direct_conversations_canonical_pair_check check (participant_low::text < participant_high::text),
  constraint direct_conversations_creator_is_participant_check check (created_by_profile_id in (participant_low, participant_high)),
  constraint direct_conversations_pair_key unique (participant_low, participant_high)
);

create index if not exists direct_conversations_low_updated_idx
  on public.direct_conversations(participant_low, updated_at desc);
create index if not exists direct_conversations_high_updated_idx
  on public.direct_conversations(participant_high, updated_at desc);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  reply_to_id uuid references public.direct_messages(id) on delete set null,
  sent_at timestamptz not null default now(),
  edited_at timestamptz,
  redacted_at timestamptz,
  constraint direct_messages_body_check check (
    char_length(trim(body)) between 1 and 4000
  )
);

create index if not exists direct_messages_conversation_sent_idx
  on public.direct_messages(conversation_id, sent_at desc);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  reply_to_id uuid references public.group_messages(id) on delete set null,
  sent_at timestamptz not null default now(),
  edited_at timestamptz,
  redacted_at timestamptz,
  constraint group_messages_body_check check (
    char_length(trim(body)) between 1 and 4000
  )
);

alter table public.group_messages
  drop constraint if exists group_messages_group_organization_fkey;

alter table public.group_messages
  add constraint group_messages_group_organization_fkey
  foreign key (group_id, organization_id)
  references public.groups(id, organization_id)
  on delete cascade;

create index if not exists group_messages_group_sent_idx
  on public.group_messages(group_id, sent_at desc);

create or replace function public.can_read_direct_conversation(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.direct_conversations c
    where c.id = target_conversation_id
      and auth.uid() in (c.participant_low, c.participant_high)
  );
$$;

revoke all on function public.can_read_direct_conversation(uuid) from public;
grant execute on function public.can_read_direct_conversation(uuid) to authenticated, service_role;

create or replace function public.can_read_group_chat(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    join public.group_memberships gm
      on gm.group_id = g.id
     and gm.organization_id = g.organization_id
     and gm.status = 'active'
    join public.memberships m
      on m.id = gm.membership_id
     and m.organization_id = gm.organization_id
    where g.id = target_group_id
      and g.is_active = true
      and m.profile_id = auth.uid()
      and m.status = 'active'
  );
$$;

revoke all on function public.can_read_group_chat(uuid) from public;
grant execute on function public.can_read_group_chat(uuid) to authenticated, service_role;

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.group_messages enable row level security;

drop policy if exists direct_conversations_participant_read on public.direct_conversations;
create policy direct_conversations_participant_read
on public.direct_conversations
for select
to authenticated
using (auth.uid() in (participant_low, participant_high));

drop policy if exists direct_messages_participant_read on public.direct_messages;
create policy direct_messages_participant_read
on public.direct_messages
for select
to authenticated
using (public.can_read_direct_conversation(conversation_id));

drop policy if exists group_messages_member_read on public.group_messages;
create policy group_messages_member_read
on public.group_messages
for select
to authenticated
using (public.can_read_group_chat(group_id));

-- Writes are performed through authenticated Edge Functions with server-side
-- safety and membership checks. Keep direct table mutation closed.
revoke insert, update, delete on public.direct_conversations from anon, authenticated;
revoke insert, update, delete on public.direct_messages from anon, authenticated;
revoke insert, update, delete on public.group_messages from anon, authenticated;
grant select on public.direct_conversations, public.direct_messages, public.group_messages to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'profile-banners',
  'profile-banners',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'direct_conversations',
    'direct_messages',
    'group_messages'
  ]
  loop
    execute format('alter table public.%I replica identity full', target_table);
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;
