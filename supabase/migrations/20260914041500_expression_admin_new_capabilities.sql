-- Extend the existing Expression Admin blueprint and already-created system roles
-- with the new ministry capabilities. Other delegated roles remain least-privilege
-- and may receive these permissions explicitly through role management.

update public.role_blueprints
set permission_codes = (
  select array_agg(distinct permission_code order by permission_code)
  from unnest(
    permission_codes || array[
      'polls.manage',
      'testimonies.review',
      'testimonies.manage',
      'finance.read',
      'finance.manage'
    ]::text[]
  ) permission_code
),
updated_at = now()
where code = 'expression_admin';

insert into public.role_permissions(role_id, permission_code)
select r.id, requested.permission_code
from public.roles r
cross join lateral unnest(array[
  'polls.manage',
  'testimonies.review',
  'testimonies.manage',
  'finance.read',
  'finance.manage'
]::text[]) requested(permission_code)
where r.code = 'expression_admin'
on conflict do nothing;

-- Poll creation follows publishing authority for existing delegated roles. This does
-- not grant poll creation to ordinary members; it mirrors an already-held publish permission.
insert into public.role_permissions(role_id, permission_code)
select distinct rp.role_id, 'polls.manage'
from public.role_permissions rp
where rp.permission_code = 'posts.publish'
on conflict do nothing;
