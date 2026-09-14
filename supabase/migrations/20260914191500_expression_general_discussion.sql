-- Expression-wide discussion channel with role-aware moderation.
-- All active, non-banned Expression members can read/post. Branch-scoped
-- members.update authority can restrict posting, ban chat access, or remove a member.

alter table public.expression_memberships
  add column if not exists chat_restricted_until timestamptz,
  add column if not exists chat_banned_at timestamptz,
  add column if not exists chat_moderated_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists chat_moderation_reason text;

alter table public.expression_memberships
  drop constraint if exists expression_memberships_chat_moderation_reason_check;
alter table public.expression_memberships
  add constraint expression_memberships_chat_moderation_reason_check
  check (chat_moderation_reason is null or char_length(chat_moderation_reason) <= 500);

create table if not exists public.expression_chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  reply_to_id uuid references public.expression_chat_messages(id) on delete set null,
  attachment_ids uuid[] not null default '{}'::uuid[],
  pinned_at timestamptz,
  pinned_by_profile_id uuid references public.profiles(id) on delete set null,
  sent_at timestamptz not null default now(),
  edited_at timestamptz,
  redacted_at timestamptz,
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade,
  constraint expression_chat_messages_body_check check (
    char_length(body) <= 4000
    and (char_length(trim(body)) >= 1 or cardinality(attachment_ids) > 0)
    and cardinality(attachment_ids) <= 4
  )
);

create index if not exists expression_chat_messages_branch_sent_idx
  on public.expression_chat_messages(branch_id, sent_at desc);
create index if not exists expression_chat_messages_sender_idx
  on public.expression_chat_messages(sender_profile_id, sent_at desc);

create table if not exists public.expression_chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.expression_chat_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint expression_chat_reactions_emoji_check check (char_length(emoji) between 1 and 16),
  constraint expression_chat_reactions_unique unique (message_id, profile_id, emoji)
);

create index if not exists expression_chat_reactions_message_idx
  on public.expression_chat_reactions(message_id, created_at);

create table if not exists public.expression_chat_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null,
  uploader_profile_id uuid not null references public.profiles(id) on delete cascade,
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
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete cascade,
  constraint expression_chat_uploads_kind_check check (media_kind in ('image','gif','video','audio')),
  constraint expression_chat_uploads_size_check check (size_bytes between 1 and 104857600),
  constraint expression_chat_uploads_duration_check check (duration_seconds is null or duration_seconds between 0 and 86400),
  constraint expression_chat_uploads_filename_check check (original_filename is null or char_length(original_filename) <= 255),
  constraint expression_chat_uploads_status_check check (status in ('pending','uploaded','attached','deleted'))
);

create index if not exists expression_chat_uploads_scope_idx
  on public.expression_chat_uploads(branch_id, status, created_at desc);
create index if not exists expression_chat_uploads_cleanup_idx
  on public.expression_chat_uploads(status, created_at)
  where status in ('pending','uploaded');

alter table public.expression_chat_messages enable row level security;
alter table public.expression_chat_reactions enable row level security;
alter table public.expression_chat_uploads enable row level security;

-- Realtime/direct readers may see discussion rows only while they are active
-- members of the exact Expression and have not been banned from Discussion.
drop policy if exists expression_chat_messages_member_read on public.expression_chat_messages;
create policy expression_chat_messages_member_read on public.expression_chat_messages
for select to authenticated
using (exists (
  select 1
  from public.expression_memberships em
  where em.organization_id = expression_chat_messages.organization_id
    and em.branch_id = expression_chat_messages.branch_id
    and em.profile_id = auth.uid()
    and em.status = 'active'
    and em.chat_banned_at is null
));

drop policy if exists expression_chat_reactions_member_read on public.expression_chat_reactions;
create policy expression_chat_reactions_member_read on public.expression_chat_reactions
for select to authenticated
using (exists (
  select 1
  from public.expression_chat_messages m
  join public.expression_memberships em
    on em.organization_id = m.organization_id
   and em.branch_id = m.branch_id
   and em.profile_id = auth.uid()
   and em.status = 'active'
   and em.chat_banned_at is null
  where m.id = expression_chat_reactions.message_id
));

-- Do not expose private storage metadata directly.
revoke all on public.expression_chat_uploads from anon, authenticated;

-- Add the new discussion tables to Realtime when the publication exists and
-- they have not already been registered.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expression_chat_messages'
    ) then
      alter publication supabase_realtime add table public.expression_chat_messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expression_chat_reactions'
    ) then
      alter publication supabase_realtime add table public.expression_chat_reactions;
    end if;
  end if;
end $$;
