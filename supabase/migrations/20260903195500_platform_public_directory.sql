-- Level-1 governance for the General Community public church story and central leadership.
-- Expression leadership remains expression-scoped and is not managed through Platform Admin.

insert into public.permissions (code, name, description, category)
values (
  'platform.public_directory.manage',
  'Manage General Community public directory',
  'Curate the public church story and central public leadership directory shown in General Community.',
  'platform'
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    is_active = true;

insert into public.platform_role_permissions (role_code, permission_code)
values
  ('super_admin', 'platform.public_directory.manage'),
  ('admin', 'platform.public_directory.manage')
on conflict do nothing;

-- Public directory artwork is intentionally public-read content. Writes are never
-- granted directly to clients; the Level-1 Edge API creates signed upload URLs after
-- platform permission checks and verifies each upload before persisting the URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-directory-media',
  'public-directory-media',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on table public.leadership_profiles is
  'Canonical leadership directory. expression_id NULL is General Community central/public leadership; expression_id NOT NULL belongs to that Expression.';
