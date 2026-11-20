-- Platform Branding, Public Church Story / Heritage, and Expression Leadership Directory

insert into public.permissions (code, name, description, category) values
  ('platform.branding.manage', 'Manage platform branding', 'Configure platform logos, in-app splash branding, and appearance.', 'administration'),
  ('organization.leadership.manage', 'Manage church story and leadership', 'Curate the public church story, heritage milestones, and featured leadership.', 'administration'),
  ('expression.leadership.manage', 'Manage expression leadership', 'Maintain leadership directory and staff profiles for specific expressions.', 'administration')
on conflict (code) do update set name = excluded.name, description = excluded.description, category = excluded.category, is_active = true;

create table public.platform_branding (
  id uuid primary key default gen_random_uuid(),
  platform_name text not null default 'Church Digital Platform',
  primary_logo_url text,
  compact_logo_url text,
  dark_logo_url text,
  public_header_logo_url text,
  launch_logo_url text,
  launch_background_url text,
  default_placeholder_logo_url text,
  default_leader_placeholder_url text,
  theme_tokens jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table public.church_story (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null default 'Our Story & Heritage',
  subtitle text not null default 'A community of faith, hope, and love.',
  mission text not null default '',
  vision text not null default '',
  founding_story text not null default '',
  founding_year integer default 2010,
  history_milestones jsonb not null default '[]'::jsonb,
  values jsonb not null default '[]'::jsonb,
  banner_image_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (organization_id)
);

create table public.leadership_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expression_id uuid references public.branches(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null check(char_length(trim(display_name)) between 1 and 120),
  portrait_url text,
  role_title text not null check(char_length(trim(role_title)) between 1 and 120),
  short_bio text not null default '',
  full_bio text not null default '',
  ministry text,
  display_order integer not null default 0,
  tenure_start date,
  tenure_end date,
  is_founder boolean not null default false,
  is_featured_public boolean not null default false,
  is_active boolean not null default true,
  social_links jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leadership_profiles_org_exp_idx on public.leadership_profiles(organization_id, expression_id, display_order);
create index leadership_profiles_public_idx on public.leadership_profiles(is_featured_public, is_active, display_order);

create trigger platform_branding_updated before update on public.platform_branding for each row execute function public.set_updated_at();
create trigger church_story_updated before update on public.church_story for each row execute function public.set_updated_at();
create trigger leadership_profiles_updated before update on public.leadership_profiles for each row execute function public.set_updated_at();

alter table public.platform_branding enable row level security;
alter table public.church_story enable row level security;
alter table public.leadership_profiles enable row level security;

create policy platform_branding_public_read on public.platform_branding
  for select using (is_active = true);

create policy platform_branding_manage on public.platform_branding
  for all to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.profile_id = auth.uid()
        and m.status = 'active'
        and public.has_permission(m.organization_id, 'platform.branding.manage')
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.profile_id = auth.uid()
        and m.status = 'active'
        and public.has_permission(m.organization_id, 'platform.branding.manage')
    )
  );

create policy church_story_public_read on public.church_story
  for select using (is_published = true);

create policy church_story_manage on public.church_story
  for all to authenticated
  using (public.has_permission(organization_id, 'organization.leadership.manage'))
  with check (public.has_permission(organization_id, 'organization.leadership.manage'));

create policy leadership_profiles_public_read on public.leadership_profiles
  for select using (is_active = true);

create policy leadership_profiles_scoped_manage on public.leadership_profiles
  for all to authenticated
  using (
    public.has_permission(organization_id, 'organization.leadership.manage')
    or (expression_id is not null and public.has_permission(organization_id, 'expression.leadership.manage', expression_id))
  )
  with check (
    public.has_permission(organization_id, 'organization.leadership.manage')
    or (expression_id is not null and public.has_permission(organization_id, 'expression.leadership.manage', expression_id))
  );

-- Insert initial default platform branding
insert into public.platform_branding (platform_name, is_active)
values ('Church Digital Platform', true)
on conflict do nothing;
