-- Make the explainable feed ranking controls available to the intended human
-- administrators without broadening other roles.

insert into public.role_permissions(role_id, permission_code)
select r.id, 'feed.ranking.manage'
from public.roles r
where r.code in ('owner', 'expression_admin')
on conflict do nothing;

-- Keep the reusable Expression Admin blueprint aligned for future Expressions.
update public.role_blueprints
set permission_codes = (
  select array_agg(distinct code order by code)
  from unnest(permission_codes || array['feed.ranking.manage']::text[]) code
), updated_at = now()
where code = 'expression_admin';
