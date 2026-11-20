-- Rich private messaging and scoped Expression Group spaces.
-- Files stay in a private bucket and are delivered through short-lived signed URLs.
-- Direct writes remain closed; authenticated Edge Functions enforce interaction,
-- membership, moderation, and management rules.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  104857600,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/wav'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.group_memberships
  add column if not exists chat_restricted_until timestamptz,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists moderation_reason text;

alter table public.group_memberships
  drop constraint if exists group_memberships_moderation_reason_check;
alter table public.group_memberships
  add constraint group_memberships_moderation_reason_check
  check (moderation_reason is null or char_length(moderation_reason) <= 500);

alter table public.group_memberships
  drop constraint if exists group_memberships_id_group_organization_key;
alter table public.group_memberships
  add constraint group_memberships_id_group_organization_key
  unique (id, group_id, organization_id);

create table if not exists public.group_chat_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  name text not null,
  description text not null default '',
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_chat_sections_group_fkey
    foreign key (group_id, organization_id)
    references public.groups(id, organization_id)
    on delete cascade,
  constraint group_chat_sections_name_check
    check (char_length(trim(name)) between 1 and 80),
  constraint group_chat_sections_description_check
    check (char_length(description) <= 1000),
  constraint group_chat_sections_expiry_check
    check (expires_at is null or expires_at > created_at),
  constraint group_chat_sections_id_group_organization_key
    unique (id, group_id, organization_id)
);

create index if not exists group_chat_sections_group_active_idx
  on public.group_chat_sections(group_id, expires_at, created_at desc)
  where is_archived = false;

create table if not exists public.group_chat_section_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  section_id uuid not null,
  group_membership_id uuid not null,
  added_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint group_chat_section_members_section_fkey
    foreign key (section_id, group_id, organization_id)
    references public.group_chat_sections(id, group_id, organization_id)
    on delete cascade,
  constraint group_chat_section_members_membership_fkey
    foreign key (group_membership_id, group_id, organization_id)
    references public.group_memberships(id, group_id, organization_id)
    on delete cascade,
  constraint group_chat_section_members_unique
    unique (section_id, group_membership_id)
);

create index if not exists group_chat_section_members_membership_idx
  on public.group_chat_section_members(group_membership_id, section_id);

alter table public.direct_messages
  add column if not exists attachment_ids uuid[] not null default '{}'::uuid[],
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by_profile_id uuid references public.profiles(id) on delete set null;

alter table public.direct_messages
  drop constraint if exists direct_messages_body_check;
alter table public.direct_messages
  add constraint direct_messages_body_check check (
    char_length(body) <= 4000
    and (char_length(trim(body)) >= 1 or cardinality(attachment_ids) > 0)
    and cardinality(attachment_ids) <= 4
  );

alter table public.group_messages
  add column if not exists section_id uuid,
  add column if not exists attachment_ids uuid[] not null default '{}'::uuid[],
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by_profile_id uuid references public.profiles(id) on delete set null;

alter table public.group_messages
  drop constraint if exists group_messages_section_fkey;
alter table public.group_messages
  add constraint group_messages_section_fkey
  foreign key (section_id, group_id, organization_id)
  references public.group_chat_sections(id, group_id, organization_id)
  on delete cascade;

alter table public.group_messages
  drop constraint if exists group_messages_body_check;
alter table public.group_messages
  add constraint group_messages_body_check check (
    char_length(body) <= 4000
    and (char_length(trim(body)) >= 1 or cardinality(attachment_ids) > 0)
    and cardinality(attachment_ids) <= 4
  );

create table if not exists public.chat_media_uploads (
  id uuid primary key default gen_random_uuid(),
  uploader_profile_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.direct_conversations(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  group_id uuid,
  section_id uuid,
  media_kind text not null,
  mime_type text not null,
  storage_path text not null unique,
  original_filename text,
  size_bytes bigint not null,
  duration_seconds integer,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  attached_at timestamptz,
  deleted_at timestamptz,
  constraint chat_media_uploads_group_fkey
    foreign key (group_id, organization_id)
    references public.groups(id, organization_id)
    on delete cascade,
  constraint chat_media_uploads_section_fkey
    foreign key (section_id, group_id, organization_id)
    references public.group_chat_sections(id, group_id, organization_id)
    on delete cascade,
  constraint chat_media_uploads_scope_check check (
    (conversation_id is not null and group_id is null and organization_id is null and section_id is null)
    or
    (conversation_id is null and group_id is not null and organization_id is not null)
  ),
  constraint chat_media_uploads_kind_check
    check (media_kind in ('image', 'gif', 'video', 'audio')),
  constraint chat_media_uploads_mime_check
    check (char_length(mime_type) between 3 and 120),
  constraint chat_media_uploads_filename_check
    check (original_filename is null or char_length(original_filename) <= 255),
  constraint chat_media_uploads_size_check
    check (size_bytes between 1 and 104857600),
  constraint chat_media_uploads_duration_check
    check (duration_seconds is null or duration_seconds between 0 and 86400),
  constraint chat_media_uploads_status_check
    check (status in ('pending', 'uploaded', 'attached', 'deleted'))
);

create index if not exists chat_media_uploads_direct_idx
  on public.chat_media_uploads(conversation_id, created_at desc)
  where conversation_id is not null;
create index if not exists chat_media_uploads_group_idx
  on public.chat_media_uploads(group_id, section_id, created_at desc)
  where group_id is not null;
create index if not exists chat_media_uploads_cleanup_idx
  on public.chat_media_uploads(status, created_at)
  where status in ('pending', 'uploaded');

create table if not exists public.direct_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint direct_message_reactions_emoji_check
    check (char_length(emoji) between 1 and 16),
  constraint direct_message_reactions_unique
    unique (message_id, profile_id, emoji)
);

create index if not exists direct_message_reactions_message_idx
  on public.direct_message_reactions(message_id, created_at);

create table if not exists public.group_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.group_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint group_message_reactions_emoji_check
    check (char_length(emoji) between 1 and 16),
  constraint group_message_reactions_unique
    unique (message_id, profile_id, emoji)
);

create index if not exists group_message_reactions_message_idx
  on public.group_message_reactions(message_id, created_at);

create table if not exists public.group_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  name text not null,
  color text not null default '#64748B',
  permissions text[] not null default '{}'::text[],
  is_system boolean not null default false,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_roles_group_fkey
    foreign key (group_id, organization_id)
    references public.groups(id, organization_id)
    on delete cascade,
  constraint group_roles_name_check
    check (char_length(trim(name)) between 1 and 50),
  constraint group_roles_color_check
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint group_roles_permissions_check check (
    permissions <@ array[
      'manage_members', 'manage_chat', 'manage_content',
      'pin_messages', 'create_sections', 'assign_roles'
    ]::text[]
  ),
  constraint group_roles_id_group_organization_key
    unique (id, group_id, organization_id)
);

create unique index if not exists group_roles_name_unique_idx
  on public.group_roles(group_id, lower(name));

create table if not exists public.group_role_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  group_role_id uuid not null,
  group_membership_id uuid not null,
  assigned_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint group_role_assignments_role_fkey
    foreign key (group_role_id, group_id, organization_id)
    references public.group_roles(id, group_id, organization_id)
    on delete cascade,
  constraint group_role_assignments_membership_fkey
    foreign key (group_membership_id, group_id, organization_id)
    references public.group_memberships(id, group_id, organization_id)
    on delete cascade,
  constraint group_role_assignments_unique
    unique (group_role_id, group_membership_id)
);

create index if not exists group_role_assignments_member_idx
  on public.group_role_assignments(group_membership_id, group_role_id);

create table if not exists public.group_announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  title text not null,
  body text not null,
  status text not null default 'published',
  is_pinned boolean not null default false,
  published_at timestamptz,
  expires_at timestamptz,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_announcements_group_fkey
    foreign key (group_id, organization_id)
    references public.groups(id, organization_id)
    on delete cascade,
  constraint group_announcements_title_check
    check (char_length(trim(title)) between 1 and 180),
  constraint group_announcements_body_check
    check (char_length(trim(body)) between 1 and 20000),
  constraint group_announcements_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint group_announcements_expiry_check
    check (expires_at is null or expires_at > created_at)
);

create index if not exists group_announcements_feed_idx
  on public.group_announcements(group_id, is_pinned desc, published_at desc, created_at desc);

create table if not exists public.group_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'UTC',
  location jsonb not null default '{}'::jsonb,
  status text not null default 'published',
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_events_group_fkey
    foreign key (group_id, organization_id)
    references public.groups(id, organization_id)
    on delete cascade,
  constraint group_events_title_check
    check (char_length(trim(title)) between 1 and 180),
  constraint group_events_description_check
    check (char_length(description) <= 20000),
  constraint group_events_time_check
    check (ends_at is null or ends_at > starts_at),
  constraint group_events_location_check
    check (jsonb_typeof(location) = 'object'),
  constraint group_events_status_check
    check (status in ('draft', 'published', 'cancelled', 'archived'))
);

create index if not exists group_events_calendar_idx
  on public.group_events(group_id, starts_at)
  where status = 'published';

create table if not exists public.group_giving_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null,
  giving_purpose_id uuid not null,
  label text not null,
  note text not null default '',
  is_active boolean not null default true,
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_giving_options_group_fkey
    foreign key (group_id, organization_id)
    references public.groups(id, organization_id)
    on delete cascade,
  constraint group_giving_options_purpose_fkey
    foreign key (giving_purpose_id, organization_id)
    references public.giving_purposes(id, organization_id)
    on delete restrict,
  constraint group_giving_options_label_check
    check (char_length(trim(label)) between 1 and 160),
  constraint group_giving_options_note_check
    check (char_length(note) <= 1000),
  constraint group_giving_options_unique
    unique (group_id, giving_purpose_id)
);

create or replace function public.can_manage_group_space(
  target_group_id uuid,
  requested_permission text default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = target_group_id
      and g.is_active = true
      and (
        g.created_by = auth.uid()
        or exists (
          select 1
          from public.group_memberships gm
          join public.memberships m
            on m.id = gm.membership_id
           and m.organization_id = gm.organization_id
           and m.status = 'active'
          where gm.group_id = g.id
            and gm.organization_id = g.organization_id
            and gm.status = 'active'
            and gm.banned_at is null
            and m.profile_id = auth.uid()
            and (
              gm.is_leader
              or (
                requested_permission is not null
                and exists (
                  select 1
                  from public.group_role_assignments gra
                  join public.group_roles gr
                    on gr.id = gra.group_role_id
                   and gr.group_id = gra.group_id
                   and gr.organization_id = gra.organization_id
                  where gra.group_id = g.id
                    and gra.organization_id = g.organization_id
                    and gra.group_membership_id = gm.id
                    and requested_permission = any(gr.permissions)
                )
              )
            )
        )
      )
  );
$$;

revoke all on function public.can_manage_group_space(uuid, text) from public, anon;
grant execute on function public.can_manage_group_space(uuid, text) to authenticated, service_role;

create or replace function public.can_read_group_chat_section(target_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_chat_sections s
    where s.id = target_section_id
      and s.is_archived = false
      and (s.expires_at is null or s.expires_at > now())
      and (
        public.can_manage_group_space(s.group_id, 'create_sections')
        or exists (
          select 1
          from public.group_chat_section_members sm
          join public.group_memberships gm
            on gm.id = sm.group_membership_id
           and gm.group_id = sm.group_id
           and gm.organization_id = sm.organization_id
           and gm.status = 'active'
           and gm.banned_at is null
          join public.memberships m
            on m.id = gm.membership_id
           and m.organization_id = gm.organization_id
           and m.status = 'active'
          where sm.section_id = s.id
            and m.profile_id = auth.uid()
        )
      )
  );
$$;

revoke all on function public.can_read_group_chat_section(uuid) from public, anon;
grant execute on function public.can_read_group_chat_section(uuid) to authenticated, service_role;

create or replace function public.seed_group_space_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_roles (
    organization_id, group_id, name, color, permissions, is_system, created_by_profile_id
  )
  values
    (
      new.organization_id, new.id, 'Admin', '#2563EB',
      array['manage_members','manage_chat','manage_content','pin_messages','create_sections','assign_roles'],
      true, new.created_by
    ),
    (
      new.organization_id, new.id, 'Moderator', '#7C3AED',
      array['manage_chat','pin_messages','create_sections'],
      true, new.created_by
    )
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.seed_group_space_roles() from public, anon, authenticated;
grant execute on function public.seed_group_space_roles() to service_role;

drop trigger if exists seed_group_space_roles_after_insert on public.groups;
create trigger seed_group_space_roles_after_insert
after insert on public.groups
for each row execute function public.seed_group_space_roles();

insert into public.group_roles (
  organization_id, group_id, name, color, permissions, is_system, created_by_profile_id
)
select
  g.organization_id, g.id, seeded.name, seeded.color, seeded.permissions, true, g.created_by
from public.groups g
cross join (
  values
    (
      'Admin'::text,
      '#2563EB'::text,
      array['manage_members','manage_chat','manage_content','pin_messages','create_sections','assign_roles']::text[]
    ),
    (
      'Moderator'::text,
      '#7C3AED'::text,
      array['manage_chat','pin_messages','create_sections']::text[]
    )
) as seeded(name, color, permissions)
on conflict do nothing;

create or replace function public.request_group_membership(target_group_id uuid)
returns public.group_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_group public.groups;
  member public.memberships;
  existing public.group_memberships;
  result public.group_memberships;
  active_count integer;
  next_status public.group_membership_status;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select * into selected_group
  from public.groups
  where id = target_group_id and is_active
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Group not found'; end if;

  select * into member
  from public.memberships
  where organization_id = selected_group.organization_id
    and profile_id = auth.uid()
    and status = 'active'
  order by created_at
  limit 1;
  if not found or not public.is_organization_member(selected_group.organization_id) then
    raise exception using errcode = '42501', message = 'Active membership required';
  end if;
  if selected_group.branch_id is not null
     and not public.is_expression_member(selected_group.organization_id, selected_group.branch_id) then
    raise exception using errcode = '42501', message = 'This group belongs to another Expression';
  end if;

  select * into existing
  from public.group_memberships
  where group_id = target_group_id and membership_id = member.id
  for update;
  if existing.banned_at is not null then
    raise exception using errcode = '42501', message = 'You have been removed from this group by a group administrator';
  end if;
  if existing.status = 'active' then return existing; end if;
  if selected_group.visibility = 'private' or selected_group.join_policy = 'invite' then
    raise exception using errcode = '42501', message = 'This private group requires an invitation';
  end if;
  if existing.status = 'requested' and selected_group.join_policy = 'approval' then return existing; end if;

  select count(*) into active_count
  from public.group_memberships
  where group_id = target_group_id and status = 'active';
  if selected_group.capacity is not null and active_count >= selected_group.capacity then
    raise exception using errcode = '23514', message = 'Group is full';
  end if;

  next_status := case when selected_group.join_policy = 'open'
    then 'active'::public.group_membership_status
    else 'requested'::public.group_membership_status
  end;

  insert into public.group_memberships (
    organization_id, group_id, membership_id, status, is_leader,
    requested_at, responded_at, chat_restricted_until, moderation_reason
  )
  values (
    selected_group.organization_id, target_group_id, member.id, next_status, false,
    now(), case when next_status = 'active' then now() else null end, null, null
  )
  on conflict (group_id, membership_id) do update set
    status = excluded.status,
    requested_at = excluded.requested_at,
    responded_at = excluded.responded_at,
    chat_restricted_until = null,
    moderation_reason = null
  returning * into result;
  return result;
end;
$$;

revoke all on function public.request_group_membership(uuid) from public, anon;
grant execute on function public.request_group_membership(uuid) to authenticated, service_role;

alter table public.group_chat_sections enable row level security;
alter table public.group_chat_section_members enable row level security;
alter table public.chat_media_uploads enable row level security;
alter table public.direct_message_reactions enable row level security;
alter table public.group_message_reactions enable row level security;
alter table public.group_roles enable row level security;
alter table public.group_role_assignments enable row level security;
alter table public.group_announcements enable row level security;
alter table public.group_events enable row level security;
alter table public.group_giving_options enable row level security;

drop policy if exists direct_messages_participant_read on public.direct_messages;
create policy direct_messages_participant_read
on public.direct_messages for select to authenticated
using (public.can_read_direct_conversation(conversation_id));

drop policy if exists group_messages_member_read on public.group_messages;
create policy group_messages_member_read
on public.group_messages for select to authenticated
using (
  public.can_read_group_chat(group_id)
  and (section_id is null or public.can_read_group_chat_section(section_id))
);

drop policy if exists group_chat_sections_member_read on public.group_chat_sections;
create policy group_chat_sections_member_read
on public.group_chat_sections for select to authenticated
using (
  public.can_read_group_chat_section(id)
  or public.can_manage_group_space(group_id, 'create_sections')
);

drop policy if exists group_chat_section_members_member_read on public.group_chat_section_members;
create policy group_chat_section_members_member_read
on public.group_chat_section_members for select to authenticated
using (
  public.can_read_group_chat_section(section_id)
  or public.can_manage_group_space(group_id, 'create_sections')
);

drop policy if exists chat_media_uploads_participant_read on public.chat_media_uploads;
create policy chat_media_uploads_participant_read
on public.chat_media_uploads for select to authenticated
using (
  uploader_profile_id = auth.uid()
  or (conversation_id is not null and public.can_read_direct_conversation(conversation_id))
  or (
    group_id is not null
    and public.can_read_group_chat(group_id)
    and (section_id is null or public.can_read_group_chat_section(section_id))
  )
);

drop policy if exists direct_message_reactions_participant_read on public.direct_message_reactions;
create policy direct_message_reactions_participant_read
on public.direct_message_reactions for select to authenticated
using (
  exists (
    select 1 from public.direct_messages dm
    where dm.id = message_id
      and public.can_read_direct_conversation(dm.conversation_id)
  )
);

drop policy if exists group_message_reactions_member_read on public.group_message_reactions;
create policy group_message_reactions_member_read
on public.group_message_reactions for select to authenticated
using (
  exists (
    select 1 from public.group_messages gm
    where gm.id = message_id
      and public.can_read_group_chat(gm.group_id)
      and (gm.section_id is null or public.can_read_group_chat_section(gm.section_id))
  )
);

drop policy if exists group_roles_member_read on public.group_roles;
create policy group_roles_member_read
on public.group_roles for select to authenticated
using (public.can_read_group_chat(group_id));

drop policy if exists group_role_assignments_member_read on public.group_role_assignments;
create policy group_role_assignments_member_read
on public.group_role_assignments for select to authenticated
using (public.can_read_group_chat(group_id));

drop policy if exists group_announcements_member_read on public.group_announcements;
create policy group_announcements_member_read
on public.group_announcements for select to authenticated
using (
  public.can_read_group_chat(group_id)
  and (
    (
      status = 'published'
      and published_at is not null
      and published_at <= now()
      and (expires_at is null or expires_at > now())
    )
    or public.can_manage_group_space(group_id, 'manage_content')
  )
);

drop policy if exists group_events_member_read on public.group_events;
create policy group_events_member_read
on public.group_events for select to authenticated
using (
  public.can_read_group_chat(group_id)
  and (
    status = 'published'
    or public.can_manage_group_space(group_id, 'manage_content')
  )
);

drop policy if exists group_giving_options_member_read on public.group_giving_options;
create policy group_giving_options_member_read
on public.group_giving_options for select to authenticated
using (
  public.can_read_group_chat(group_id)
  and (is_active or public.can_manage_group_space(group_id, 'manage_content'))
);

revoke insert, update, delete on
  public.group_chat_sections,
  public.group_chat_section_members,
  public.chat_media_uploads,
  public.direct_message_reactions,
  public.group_message_reactions,
  public.group_roles,
  public.group_role_assignments,
  public.group_announcements,
  public.group_events,
  public.group_giving_options
from anon, authenticated;

grant select on
  public.group_chat_sections,
  public.group_chat_section_members,
  public.chat_media_uploads,
  public.direct_message_reactions,
  public.group_message_reactions,
  public.group_roles,
  public.group_role_assignments,
  public.group_announcements,
  public.group_events,
  public.group_giving_options
to authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'direct_messages',
    'group_messages',
    'direct_message_reactions',
    'group_message_reactions',
    'group_chat_sections',
    'group_chat_section_members',
    'group_roles',
    'group_role_assignments',
    'group_announcements',
    'group_events',
    'group_giving_options'
  ]
  loop
    execute format('alter table public.%I replica identity full', target_table);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;
