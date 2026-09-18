-- Hide expired temporary Group rooms and separate Group giving authority
-- from generic content management.

alter table public.group_roles
  drop constraint if exists group_roles_permissions_check;

alter table public.group_roles
  add constraint group_roles_permissions_check check (
    permissions <@ array[
      'manage_members', 'manage_chat', 'manage_content',
      'pin_messages', 'create_sections', 'assign_roles', 'manage_giving'
    ]::text[]
  );

update public.group_roles
set permissions = case
  when 'manage_giving' = any(permissions) then permissions
  else array_append(permissions, 'manage_giving')
end,
updated_at = now()
where is_system = true
  and lower(name) = 'admin';

insert into public.group_roles (
  organization_id, group_id, name, color, permissions, is_system, created_by_profile_id
)
select
  g.organization_id,
  g.id,
  'Giving Manager',
  '#0F766E',
  array['manage_giving']::text[],
  true,
  g.created_by
from public.groups g
on conflict do nothing;

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
      array['manage_members','manage_chat','manage_content','pin_messages','create_sections','assign_roles','manage_giving'],
      true, new.created_by
    ),
    (
      new.organization_id, new.id, 'Moderator', '#7C3AED',
      array['manage_chat','pin_messages','create_sections'],
      true, new.created_by
    ),
    (
      new.organization_id, new.id, 'Giving Manager', '#0F766E',
      array['manage_giving'],
      true, new.created_by
    )
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.seed_group_space_roles() from public, anon, authenticated;
grant execute on function public.seed_group_space_roles() to service_role;

update public.group_chat_sections
set is_archived = true,
    updated_at = now()
where is_archived = false
  and expires_at is not null
  and expires_at <= now();
