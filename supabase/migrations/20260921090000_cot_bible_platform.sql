-- COT Bible platform: reader state, daily Scripture, ministry scheduling,
-- personal study tools, reading plans, provider registry, and notification delivery.

insert into public.permissions(code,name,description,category) values
  ('bible.manage','Manage Bible & Daily Scripture','Manage Bible provider preferences, Daily Scripture scheduling, themes and reading plans.','content')
on conflict(code) do update set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

insert into public.role_permissions(role_id,permission_code)
select distinct rp.role_id,'bible.manage'
from public.role_permissions rp
where rp.permission_code in ('sermons.manage','organization.leadership.manage')
on conflict do nothing;

insert into public.platform_feature_flags(key,name,category,description,global_enabled,rollout_percentage,configuration) values
  ('bible','Bible','content','COT Bible reader, study tools and Scripture deep links.',true,100,'{"operationalVisible":true,"scopes":["organization"]}'::jsonb),
  ('daily_scripture','Daily Scripture','content','Daily Scripture card, scheduling and optional reminders.',true,100,'{"operationalVisible":true,"parentKey":"bible","scopes":["organization"]}'::jsonb),
  ('scripture_previews','Scripture previews','content','Detect Bible references in COT content and show Scripture previews.',true,100,'{"operationalVisible":true,"parentKey":"bible","scopes":["organization","expression","group"]}'::jsonb),
  ('bible_notes','Bible notes & highlights','content','Personal Bible bookmarks, notes and highlights.',true,100,'{"operationalVisible":true,"parentKey":"bible","scopes":["organization"]}'::jsonb),
  ('bible_reading_plans','Bible reading plans','content','Reading plans and member progress.',true,100,'{"operationalVisible":true,"parentKey":"bible","scopes":["organization"]}'::jsonb),
  ('bible_audio','Bible audio','content','Recorded-audio provider support with COT read-aloud fallback.',true,100,'{"operationalVisible":true,"parentKey":"bible","scopes":["organization"]}'::jsonb)
on conflict(key) do update set
  name=excluded.name,category=excluded.category,description=excluded.description,
  global_enabled=excluded.global_enabled,rollout_percentage=excluded.rollout_percentage,
  configuration=excluded.configuration,updated_at=now();

create table if not exists public.bible_provider_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null check(provider_key in ('web_public_domain','youversion','bible_brain')),
  enabled boolean not null default true,
  priority integer not null default 100,
  configuration jsonb not null default '{}'::jsonb check(jsonb_typeof(configuration)='object'),
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique(organization_id,provider_key)
);

create table if not exists public.bible_daily_pool (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  reference text not null check(char_length(trim(reference)) between 3 and 80),
  theme text not null default 'general' check(char_length(trim(theme)) between 2 and 80),
  weight integer not null default 100 check(weight between 1 and 1000),
  active boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique nulls not distinct(organization_id,reference)
);

create table if not exists public.bible_daily_schedule (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scripture_date date not null,
  reference text not null check(char_length(trim(reference)) between 3 and 80),
  version_id text not null default 'web',
  theme text not null default 'general',
  source text not null default 'automatic' check(source in ('automatic','ministry','youversion')),
  message text null check(message is null or char_length(message) <= 280),
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,scripture_date)
);

create table if not exists public.bible_user_preferences (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  default_version_id text not null default 'web',
  language_tag text not null default 'en',
  daily_scripture_notification boolean not null default false,
  notification_time time not null default '07:00',
  timezone text not null default 'Africa/Lagos',
  audio_rate numeric(3,2) not null default 1.00 check(audio_rate between 0.5 and 2.0),
  updated_at timestamptz not null default now(),
  primary key(profile_id,organization_id)
);

create table if not exists public.bible_bookmarks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference text not null,
  version_id text not null default 'web',
  label text null check(label is null or char_length(label)<=160),
  created_at timestamptz not null default now(),
  unique(profile_id,organization_id,reference,version_id)
);

create table if not exists public.bible_highlights (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference text not null,
  version_id text not null default 'web',
  color_key text not null default 'gold' check(color_key in ('gold','blue','green','rose','violet')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id,organization_id,reference,version_id)
);

create table if not exists public.bible_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference text not null,
  version_id text not null default 'web',
  body text not null check(char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id,organization_id,reference,version_id)
);

create table if not exists public.bible_reading_history (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference text not null,
  version_id text not null default 'web',
  last_read_at timestamptz not null default now(),
  read_count integer not null default 1,
  primary key(profile_id,organization_id,reference,version_id)
);

create table if not exists public.bible_reading_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  duration_days integer not null check(duration_days between 1 and 730),
  is_public boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique nulls not distinct(organization_id,slug)
);

create table if not exists public.bible_reading_plan_days (
  plan_id uuid not null references public.bible_reading_plans(id) on delete cascade,
  day_number integer not null check(day_number>=1),
  title text null,
  references text[] not null default '{}',
  reflection text null,
  primary key(plan_id,day_number)
);

create table if not exists public.bible_reading_plan_progress (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.bible_reading_plans(id) on delete cascade,
  started_at timestamptz not null default now(),
  current_day integer not null default 1,
  completed_days integer[] not null default '{}',
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  primary key(profile_id,plan_id)
);

-- Cache only public-domain/free Bible payloads. Licensed YouVersion text remains provider-served.
create table if not exists public.bible_public_passage_cache (
  cache_key text primary key,
  version_id text not null,
  reference text not null,
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  fetched_at timestamptz not null default now()
);

create index if not exists bible_daily_schedule_date_idx on public.bible_daily_schedule(organization_id,scripture_date desc);
create index if not exists bible_bookmarks_profile_idx on public.bible_bookmarks(profile_id,created_at desc);
create index if not exists bible_notes_profile_idx on public.bible_notes(profile_id,updated_at desc);
create index if not exists bible_history_profile_idx on public.bible_reading_history(profile_id,last_read_at desc);

alter table public.bible_provider_settings enable row level security;
alter table public.bible_daily_pool enable row level security;
alter table public.bible_daily_schedule enable row level security;
alter table public.bible_user_preferences enable row level security;
alter table public.bible_bookmarks enable row level security;
alter table public.bible_highlights enable row level security;
alter table public.bible_notes enable row level security;
alter table public.bible_reading_history enable row level security;
alter table public.bible_reading_plans enable row level security;
alter table public.bible_reading_plan_days enable row level security;
alter table public.bible_reading_plan_progress enable row level security;
alter table public.bible_public_passage_cache enable row level security;

create policy bible_provider_read on public.bible_provider_settings for select to authenticated using(true);
create policy bible_daily_pool_read on public.bible_daily_pool for select to anon,authenticated using(active);
create policy bible_daily_schedule_read on public.bible_daily_schedule for select to anon,authenticated using(true);
create policy bible_preferences_self on public.bible_user_preferences for all to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
create policy bible_bookmarks_self on public.bible_bookmarks for all to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
create policy bible_highlights_self on public.bible_highlights for all to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
create policy bible_notes_self on public.bible_notes for all to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
create policy bible_history_self on public.bible_reading_history for all to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
create policy bible_plans_read on public.bible_reading_plans for select to anon,authenticated using(is_public);
create policy bible_plan_days_read on public.bible_reading_plan_days for select to anon,authenticated using(exists(select 1 from public.bible_reading_plans p where p.id=plan_id and p.is_public));
create policy bible_progress_self on public.bible_reading_plan_progress for all to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
create policy bible_cache_read on public.bible_public_passage_cache for select to anon,authenticated using(true);

revoke insert,update,delete on public.bible_provider_settings,public.bible_daily_pool,public.bible_daily_schedule,public.bible_reading_plans,public.bible_reading_plan_days,public.bible_public_passage_cache from anon,authenticated;

insert into public.bible_daily_pool(organization_id,reference,theme,weight) values
 (null,'Psalm 46:1','strength',100),(null,'Psalm 46:10','peace',100),(null,'Psalm 23:1-4','comfort',100),
 (null,'Proverbs 3:5-6','guidance',100),(null,'Isaiah 40:31','hope',100),(null,'Isaiah 41:10','courage',100),
 (null,'Jeremiah 29:11','hope',100),(null,'Matthew 5:14-16','witness',100),(null,'Matthew 6:33-34','trust',100),
 (null,'Matthew 11:28-30','rest',100),(null,'John 3:16','salvation',100),(null,'John 14:27','peace',100),
 (null,'John 15:5','abiding',100),(null,'Romans 5:8','grace',100),(null,'Romans 8:28','trust',100),
 (null,'Romans 8:38-39','love',100),(null,'Romans 12:2','renewal',100),(null,'1 Corinthians 13:4-7','love',100),
 (null,'2 Corinthians 5:17','renewal',100),(null,'2 Corinthians 12:9','grace',100),(null,'Galatians 5:22-23','character',100),
 (null,'Ephesians 2:8-10','grace',100),(null,'Ephesians 3:20-21','faith',100),(null,'Philippians 4:6-7','peace',100),
 (null,'Philippians 4:13','strength',100),(null,'Colossians 3:12-14','love',100),(null,'1 Thessalonians 5:16-18','prayer',100),
 (null,'2 Timothy 1:7','courage',100),(null,'Hebrews 11:1','faith',100),(null,'Hebrews 12:1-2','endurance',100),
 (null,'James 1:5','wisdom',100),(null,'1 Peter 5:7','peace',100),(null,'1 John 4:19','love',100)
on conflict do nothing;

do $$
declare pid uuid;
begin
  insert into public.bible_reading_plans(organization_id,slug,title,description,duration_days,is_public)
  values(null,'start-with-john','Start with John','A seven-day introduction to Jesus through the Gospel of John.',7,true)
  on conflict(organization_id,slug) do update set title=excluded.title,description=excluded.description,duration_days=excluded.duration_days
  returning id into pid;
  insert into public.bible_reading_plan_days(plan_id,day_number,title,references,reflection) values
    (pid,1,'The Word became flesh',array['John 1:1-18'],'Notice how John introduces Jesus before describing His earthly ministry.'),
    (pid,2,'A new beginning',array['John 3:1-21'],'Reflect on what Jesus means by being born again.'),
    (pid,3,'Living water',array['John 4:1-30'],'Bring your deepest thirst honestly before Christ.'),
    (pid,4,'Bread of life',array['John 6:25-40'],'What are you asking Jesus to satisfy today?'),
    (pid,5,'Light in darkness',array['John 8:12-20'],'Consider one area where you need to walk in Christ''s light.'),
    (pid,6,'The good shepherd',array['John 10:1-18'],'Listen for the Shepherd''s voice and care.'),
    (pid,7,'Resurrection and life',array['John 20:1-31'],'End the week by reflecting on why John says he wrote his Gospel.')
  on conflict(plan_id,day_number) do update set title=excluded.title,references=excluded.references,reflection=excluded.reflection;
end $$;

create or replace function public.resolve_daily_scripture(target_organization_id uuid,target_date date default current_date)
returns table(reference text,version_id text,theme text,source text,message text)
language plpgsql security definer set search_path='' as $$
declare picked public.bible_daily_pool;
begin
  return query
  select s.reference,s.version_id,s.theme,s.source,s.message
  from public.bible_daily_schedule s
  where s.organization_id=target_organization_id and s.scripture_date=target_date;
  if found then return; end if;

  select p.* into picked
  from public.bible_daily_pool p
  where p.active and (p.organization_id is null or p.organization_id=target_organization_id)
  order by md5(target_date::text||':'||target_organization_id::text||':'||p.reference)
  limit 1;

  if picked.id is null then return; end if;
  return query select picked.reference,'web'::text,picked.theme,'automatic'::text,null::text;
end $$;

revoke all on function public.resolve_daily_scripture(uuid,date) from public;
grant execute on function public.resolve_daily_scripture(uuid,date) to anon,authenticated,service_role;

create or replace function public.enqueue_due_daily_scripture_notifications()
returns integer
language plpgsql security definer set search_path='' as $$
declare inserted_count integer := 0;
begin
  with due as (
    select distinct on (p.profile_id,p.organization_id)
      p.profile_id,p.organization_id,p.timezone,p.notification_time,
      (now() at time zone p.timezone)::date as local_date
    from public.bible_user_preferences p
    where p.daily_scripture_notification
      and extract(hour from (now() at time zone p.timezone))=extract(hour from p.notification_time)
      and extract(minute from (now() at time zone p.timezone)) between 0 and 29
  ), resolved as (
    select d.*,s.reference,s.version_id,s.theme
    from due d
    cross join lateral public.resolve_daily_scripture(d.organization_id,d.local_date) s
  )
  insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
  select
    r.organization_id,r.profile_id,'daily_scripture','Today''s Scripture',r.reference,
    jsonb_build_object(
      'scope','general','entityType','bible','reference',r.reference,'versionId',r.version_id,
      'theme',r.theme,'route','/general/bible?reference='||replace(r.reference,' ','%20'),
      'dedupKey','daily-scripture:'||r.local_date::text
    )
  from resolved r
  on conflict do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;

revoke all on function public.enqueue_due_daily_scripture_notifications() from public,anon,authenticated;
grant execute on function public.enqueue_due_daily_scripture_notifications() to service_role;

do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    begin perform cron.unschedule('cot-bible-daily-scripture'); exception when others then null; end;
    perform cron.schedule('cot-bible-daily-scripture','*/30 * * * *','select public.enqueue_due_daily_scripture_notifications();');
  end if;
end $$;
