alter table public.branches add column if not exists avatar_url text;
alter table public.branches add column if not exists banner_url text;

comment on column public.branches.avatar_url is 'Expression square profile image used in member-facing surfaces.';
comment on column public.branches.banner_url is 'Expression wide banner image used in member-facing surfaces.';

alter table public.messages replica identity full;
alter table public.content_items replica identity full;
alter table public.content_comments replica identity full;
alter table public.social_comments replica identity full;
alter table public.media_assets replica identity full;
alter table public.live_streams replica identity full;
alter table public.groups replica identity full;
alter table public.branches replica identity full;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'messages',
    'content_items',
    'content_comments',
    'social_comments',
    'media_assets',
    'live_streams',
    'groups',
    'branches'
  ]
  loop
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
