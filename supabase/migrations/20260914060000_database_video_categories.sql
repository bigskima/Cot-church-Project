-- Replace mobile hardcoded Watch category lists with organization-controlled
-- database options while keeping the existing video_category enum and historical
-- videos compatible. Admins may relabel, reorder or disable categories without an
-- app deployment; the category key remains constrained by the canonical DB enum.

create table if not exists public.video_category_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category public.video_category not null,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  aliases text[] not null default '{}',
  description text not null default '',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, category)
);

alter table public.video_category_options enable row level security;

drop policy if exists video_category_options_read on public.video_category_options;
create policy video_category_options_read on public.video_category_options for select
using (exists(select 1 from public.organizations o where o.id = organization_id and o.status = 'active'));

drop policy if exists video_category_options_manage on public.video_category_options;
create policy video_category_options_manage on public.video_category_options for all to authenticated
using (
  public.has_platform_permission('platform.features.manage')
  or public.has_permission(organization_id, 'organization.leadership.manage', null)
)
with check (
  public.has_platform_permission('platform.features.manage')
  or public.has_permission(organization_id, 'organization.leadership.manage', null)
);

grant select on public.video_category_options to anon, authenticated;
grant insert, update, delete on public.video_category_options to authenticated;

drop trigger if exists video_category_options_updated on public.video_category_options;
create trigger video_category_options_updated
before update on public.video_category_options
for each row execute function public.set_updated_at();

insert into public.video_category_options(organization_id, category, label, display_order)
select
  o.id,
  category_value::public.video_category,
  initcap(replace(category_value, '_', ' ')),
  ordinality - 1
from public.organizations o
cross join unnest(enum_range(null::public.video_category)::text[]) with ordinality as categories(category_value, ordinality)
on conflict (organization_id, category) do nothing;

create or replace function public.get_video_category_options(target_organization_id uuid)
returns table(category text, label text, aliases text[], description text, display_order integer)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    v.category::text,
    v.label,
    v.aliases,
    v.description,
    v.display_order
  from public.video_category_options v
  where v.organization_id = target_organization_id
    and v.is_active
    and exists(select 1 from public.organizations o where o.id = target_organization_id and o.status = 'active')
  order by v.display_order, v.label;
$function$;

grant execute on function public.get_video_category_options(uuid) to anon, authenticated;

comment on table public.video_category_options is
  'Organization-controlled Watch category labels, aliases, ordering and active state. Category keys remain compatible with the canonical video_category enum.';
