begin;

-- Platform-wide Bible governance. Provider/translation availability belongs to
-- Platform Administration; church ministry remains responsible for daily
-- Scripture, curated passages and reading plans.

insert into public.permissions(code,name,description,category) values
  ('platform.bible.read','View Bible infrastructure','Inspect Bible providers, translations, defaults and runtime readiness.','platform'),
  ('platform.bible.manage','Manage Bible infrastructure','Configure Bible providers, active translations and the platform default translation.','platform')
on conflict(code) do update
set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

insert into public.platform_role_permissions(role_code,permission_code) values
  ('super_admin','platform.bible.read'),
  ('super_admin','platform.bible.manage'),
  ('admin','platform.bible.read'),
  ('admin','platform.bible.manage'),
  ('operations','platform.bible.read')
on conflict do nothing;

create table if not exists public.platform_bible_providers (
  provider_key text primary key check(provider_key in ('getbible','youversion','bible_brain')),
  display_name text not null,
  provider_kind text not null check(provider_kind in ('text','licensed_text','audio')),
  enabled boolean not null default true,
  priority integer not null default 100 check(priority between 1 and 10000),
  configuration jsonb not null default '{}'::jsonb check(jsonb_typeof(configuration)='object'),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_bible_translation_settings (
  provider_key text not null references public.platform_bible_providers(provider_key) on delete cascade,
  version_id text not null,
  abbreviation text not null,
  title text not null,
  language_tag text not null default 'en',
  copyright text,
  enabled boolean not null default true,
  is_default boolean not null default false,
  priority integer not null default 100 check(priority between 1 and 10000),
  configuration jsonb not null default '{}'::jsonb check(jsonb_typeof(configuration)='object'),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(provider_key,version_id)
);

create unique index if not exists platform_bible_one_default_idx
  on public.platform_bible_translation_settings((is_default))
  where is_default=true;

alter table public.platform_bible_providers enable row level security;
alter table public.platform_bible_translation_settings enable row level security;

revoke all on public.platform_bible_providers from anon,authenticated;
revoke all on public.platform_bible_translation_settings from anon,authenticated;
grant all on public.platform_bible_providers to service_role;
grant all on public.platform_bible_translation_settings to service_role;

insert into public.platform_bible_providers(provider_key,display_name,provider_kind,enabled,priority)
values
  ('getbible','Public-domain Bible text','text',true,10),
  ('youversion','YouVersion','licensed_text',true,20),
  ('bible_brain','Bible Brain audio','audio',true,30)
on conflict(provider_key) do update
set display_name=excluded.display_name,
    provider_kind=excluded.provider_kind;

-- KJV is the production public-domain base. WEB remains in the governance
-- catalogue but is disabled and is no longer a member-facing default.
insert into public.platform_bible_translation_settings(
  provider_key,version_id,abbreviation,title,language_tag,copyright,enabled,is_default,priority
) values
  ('getbible','kjv','KJV','King James Version','en','Public Domain',true,true,10),
  ('getbible','web','WEB','World English Bible','en','Public Domain',false,false,900)
on conflict(provider_key,version_id) do update
set abbreviation=excluded.abbreviation,
    title=excluded.title,
    language_tag=excluded.language_tag,
    copyright=excluded.copyright,
    enabled=excluded.enabled,
    is_default=excluded.is_default,
    priority=excluded.priority,
    updated_at=now();

-- Replace WEB as the schema/runtime default.
alter table public.bible_daily_schedule alter column version_id set default 'kjv';
alter table public.bible_user_preferences alter column default_version_id set default 'kjv';
alter table public.bible_bookmarks alter column version_id set default 'kjv';
alter table public.bible_highlights alter column version_id set default 'kjv';
alter table public.bible_notes alter column version_id set default 'kjv';
alter table public.bible_reading_history alter column version_id set default 'kjv';

update public.bible_daily_schedule set version_id='kjv' where lower(version_id)='web';
update public.bible_user_preferences set default_version_id='kjv' where lower(default_version_id)='web';

-- Keep personal study records usable after WEB is retired. Resolve possible
-- duplicate KJV/WEB keys before normalising the remaining legacy rows.
delete from public.bible_bookmarks w
using public.bible_bookmarks k
where lower(w.version_id)='web' and lower(k.version_id)='kjv'
  and w.profile_id=k.profile_id and w.organization_id=k.organization_id and w.reference=k.reference;
update public.bible_bookmarks set version_id='kjv' where lower(version_id)='web';

delete from public.bible_highlights w
using public.bible_highlights k
where lower(w.version_id)='web' and lower(k.version_id)='kjv'
  and w.profile_id=k.profile_id and w.organization_id=k.organization_id and w.reference=k.reference;
update public.bible_highlights set version_id='kjv' where lower(version_id)='web';

delete from public.bible_notes w
using public.bible_notes k
where lower(w.version_id)='web' and lower(k.version_id)='kjv'
  and w.profile_id=k.profile_id and w.organization_id=k.organization_id and w.reference=k.reference;
update public.bible_notes set version_id='kjv' where lower(version_id)='web';

delete from public.bible_reading_history w
using public.bible_reading_history k
where lower(w.version_id)='web' and lower(k.version_id)='kjv'
  and w.profile_id=k.profile_id and w.organization_id=k.organization_id and w.reference=k.reference;
update public.bible_reading_history set version_id='kjv' where lower(version_id)='web';

delete from public.bible_public_passage_cache where lower(version_id)='web';
update public.bible_provider_settings
set enabled=false, updated_at=now()
where provider_key='web_public_domain';

create or replace function public.resolve_daily_scripture(
  target_organization_id uuid,
  target_date date default current_date
)
returns table(reference text,version_id text,theme text,source text,message text)
language plpgsql
security definer
set search_path=''
as $$
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
  return query select picked.reference,'kjv'::text,picked.theme,'automatic'::text,null::text;
end $$;

revoke all on function public.resolve_daily_scripture(uuid,date) from public,anon,authenticated;
grant execute on function public.resolve_daily_scripture(uuid,date) to service_role;

commit;
