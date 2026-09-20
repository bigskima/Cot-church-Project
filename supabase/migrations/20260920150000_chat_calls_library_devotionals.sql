-- COT chat calls, library/books, and date-driven devotionals.
-- Calls stay authorized by the chat scope that created them. Library publishing
-- inherits sermon ministry authority; storage remains private and signed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-books','library-books',false,78643200,array['application/epub+zip','application/pdf'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-covers','library-covers',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.chat_call_sessions (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('direct','expression','group')),
  organization_id uuid references public.organizations(id) on delete cascade,
  expression_id uuid references public.branches(id) on delete cascade,
  conversation_id uuid references public.direct_conversations(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  section_id uuid references public.group_chat_sections(id) on delete cascade,
  created_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  call_kind text not null check (call_kind in ('audio','video')),
  agora_channel_name text not null unique,
  status text not null default 'ringing' check (status in ('ringing','active','ended','cancelled')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint chat_call_scope_check check (
    (scope='direct' and conversation_id is not null and organization_id is null and expression_id is null and group_id is null and section_id is null)
    or (scope='expression' and organization_id is not null and expression_id is not null and conversation_id is null and group_id is null and section_id is null)
    or (scope='group' and organization_id is not null and group_id is not null and conversation_id is null and expression_id is null)
  )
);
create unique index if not exists chat_call_one_direct_active_idx on public.chat_call_sessions(conversation_id) where scope='direct' and status in ('ringing','active');
create unique index if not exists chat_call_one_expression_active_idx on public.chat_call_sessions(organization_id,expression_id) where scope='expression' and status in ('ringing','active');
create unique index if not exists chat_call_one_group_active_idx on public.chat_call_sessions(organization_id,group_id,coalesce(section_id,'00000000-0000-0000-0000-000000000000'::uuid)) where scope='group' and status in ('ringing','active');
create index if not exists chat_call_sessions_recent_idx on public.chat_call_sessions(created_at desc);

create table if not exists public.chat_call_participants (
  call_id uuid not null references public.chat_call_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  state text not null default 'invited' check (state in ('invited','joined','declined','left','missed')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  left_at timestamptz,
  primary key(call_id,profile_id)
);
create index if not exists chat_call_participants_profile_idx on public.chat_call_participants(profile_id,invited_at desc);

create or replace function public.can_access_chat_call(target_call_id uuid,target_profile_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.chat_call_sessions c
    where c.id=target_call_id and target_profile_id is not null and (
      (c.scope='direct' and exists (
        select 1 from public.direct_conversations dc
        where dc.id=c.conversation_id and target_profile_id in (dc.participant_low,dc.participant_high)
      ))
      or (c.scope='expression' and exists (
        select 1 from public.expression_memberships em
        where em.organization_id=c.organization_id and em.branch_id=c.expression_id
          and em.profile_id=target_profile_id and em.status='active' and em.chat_banned_at is null
      ))
      or (c.scope='group' and exists (
        select 1 from public.memberships m
        join public.group_memberships gm on gm.membership_id=m.id and gm.group_id=c.group_id and gm.organization_id=c.organization_id
        where m.organization_id=c.organization_id and m.profile_id=target_profile_id and m.status='active'
          and gm.status='active' and gm.banned_at is null
          and (c.section_id is null or exists (
            select 1 from public.group_chat_sections s
            join public.group_chat_section_members sm on sm.section_id=s.id and sm.group_id=s.group_id
              and sm.organization_id=s.organization_id and sm.group_membership_id=gm.id
            where s.id=c.section_id and s.group_id=c.group_id and s.organization_id=c.organization_id
              and s.is_archived=false and (s.expires_at is null or s.expires_at>now())
          ))
      ))
    )
  );
$$;
revoke all on function public.can_access_chat_call(uuid,uuid) from public;
grant execute on function public.can_access_chat_call(uuid,uuid) to authenticated;

alter table public.chat_call_sessions enable row level security;
alter table public.chat_call_participants enable row level security;
drop policy if exists chat_call_sessions_read on public.chat_call_sessions;
create policy chat_call_sessions_read on public.chat_call_sessions for select to authenticated using(public.can_access_chat_call(id,auth.uid()));
drop policy if exists chat_call_participants_read on public.chat_call_participants;
create policy chat_call_participants_read on public.chat_call_participants for select to authenticated using(public.can_access_chat_call(call_id,auth.uid()));

create table if not exists public.library_books (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check(char_length(trim(title)) between 1 and 180),
  subtitle text not null default '' check(char_length(subtitle)<=240),
  author_name text not null check(char_length(trim(author_name)) between 1 and 160),
  publisher text not null default '' check(char_length(publisher)<=160),
  isbn text,
  description text not null default '' check(char_length(description)<=5000),
  source_format text not null check(source_format in ('epub','pdf')),
  source_path text not null unique,
  rights_basis text not null check(rights_basis in ('author_owned','church_owned','licensed','public_domain','other')),
  rights_note text not null default '' check(char_length(rights_note)<=1000),
  redistribution_confirmed boolean not null default false,
  status text not null default 'draft' check(status in ('draft','processing','published','failed','archived')),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists library_books_public_idx on public.library_books(organization_id,published_at desc) where status='published';

create table if not exists public.library_book_chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.library_books(id) on delete cascade,
  chapter_order integer not null check(chapter_order>=0),
  title text not null default '',
  body text not null default '',
  source_href text,
  created_at timestamptz not null default now(),
  unique(book_id,chapter_order)
);
create index if not exists library_book_chapters_book_idx on public.library_book_chapters(book_id,chapter_order);

create table if not exists public.library_reviews (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.library_books(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check(rating between 1 and 5),
  body text not null default '' check(char_length(body)<=2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id,profile_id)
);
create index if not exists library_reviews_book_idx on public.library_reviews(book_id,created_at desc);

create table if not exists public.library_reading_progress (
  book_id uuid not null references public.library_books(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  chapter_order integer not null default 0 check(chapter_order>=0),
  page_index integer not null default 0 check(page_index>=0),
  progress_percent numeric(5,2) not null default 0 check(progress_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key(book_id,profile_id)
);
create index if not exists library_reading_progress_profile_idx on public.library_reading_progress(profile_id,updated_at desc);

create table if not exists public.devotional_series (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid references public.library_books(id) on delete set null,
  title text not null check(char_length(trim(title)) between 1 and 180),
  author_name text not null default '' check(char_length(author_name)<=160),
  devotional_year integer not null check(devotional_year between 2000 and 2200),
  description text not null default '' check(char_length(description)<=3000),
  status text not null default 'draft' check(status in ('draft','published','archived')),
  created_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists devotional_series_org_year_idx on public.devotional_series(organization_id,devotional_year desc,created_at desc);

create table if not exists public.devotional_entries (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.devotional_series(id) on delete cascade,
  chapter_id uuid references public.library_book_chapters(id) on delete set null,
  devotional_date date not null,
  title text not null default '',
  scripture text not null default '',
  memory_verse text not null default '',
  body text not null default '',
  prayer text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(series_id,devotional_date)
);
create index if not exists devotional_entries_date_idx on public.devotional_entries(devotional_date,series_id);

alter table public.library_books enable row level security;
alter table public.library_book_chapters enable row level security;
alter table public.library_reviews enable row level security;
alter table public.library_reading_progress enable row level security;
alter table public.devotional_series enable row level security;
alter table public.devotional_entries enable row level security;

drop policy if exists library_books_read on public.library_books;
create policy library_books_read on public.library_books for select using(
  status='published' or created_by_profile_id=auth.uid()
  or public.has_permission(organization_id,'sermons.create',null)
  or public.has_permission(organization_id,'sermons.manage',null)
);
drop policy if exists library_chapters_read on public.library_book_chapters;
create policy library_chapters_read on public.library_book_chapters for select using(exists(
  select 1 from public.library_books b where b.id=book_id and (
    b.status='published' or b.created_by_profile_id=auth.uid()
    or public.has_permission(b.organization_id,'sermons.create',null)
    or public.has_permission(b.organization_id,'sermons.manage',null)
  )
));
drop policy if exists library_reviews_read on public.library_reviews;
create policy library_reviews_read on public.library_reviews for select using(exists(select 1 from public.library_books b where b.id=book_id and b.status='published'));
drop policy if exists library_progress_self on public.library_reading_progress;
create policy library_progress_self on public.library_reading_progress for select to authenticated using(profile_id=auth.uid());
drop policy if exists devotional_series_read on public.devotional_series;
create policy devotional_series_read on public.devotional_series for select using(
  status='published' or created_by_profile_id=auth.uid()
  or public.has_permission(organization_id,'sermons.create',null)
  or public.has_permission(organization_id,'sermons.manage',null)
);
drop policy if exists devotional_entries_read on public.devotional_entries;
create policy devotional_entries_read on public.devotional_entries for select using(exists(
  select 1 from public.devotional_series s where s.id=series_id and (
    s.status='published' or s.created_by_profile_id=auth.uid()
    or public.has_permission(s.organization_id,'sermons.create',null)
    or public.has_permission(s.organization_id,'sermons.manage',null)
  )
));

create trigger chat_call_sessions_updated before update on public.chat_call_sessions for each row execute function public.set_updated_at();
create trigger library_books_updated before update on public.library_books for each row execute function public.set_updated_at();
create trigger library_reviews_updated before update on public.library_reviews for each row execute function public.set_updated_at();
create trigger devotional_series_updated before update on public.devotional_series for each row execute function public.set_updated_at();
create trigger devotional_entries_updated before update on public.devotional_entries for each row execute function public.set_updated_at();

do $$ begin alter publication supabase_realtime add table public.chat_call_sessions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_call_participants; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.library_books; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.library_reviews; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.library_reading_progress; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.devotional_series; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.devotional_entries; exception when duplicate_object then null; end $$;
