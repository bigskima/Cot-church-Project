-- Live-service altar, counselling, prayer, and membership-interest follow-ups are
-- pastoral operational data. They are exact-scope and never Platform Admin data.

insert into public.permissions(code,name,description,category) values
  ('pastoral.followups.receive','Receive pastoral follow-ups','Receive live-service altar, counselling and ministry follow-up requests in the exact assigned scope.','pastoral')
on conflict(code) do update
set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

update public.role_blueprints
set permission_codes=(
  select array_agg(distinct permission_code order by permission_code)
  from unnest(permission_codes || array['pastoral.followups.receive']) permission_code
)
where code='pastoral_care';

insert into public.role_permissions(role_id,permission_code)
select r.id,'pastoral.followups.receive'
from public.roles r
where r.code='pastoral_care'
on conflict do nothing;

create or replace function public.can_receive_pastoral_followups(
  target_organization_id uuid,
  target_branch_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select public.has_exact_scope_permission(
    target_organization_id,
    'pastoral.followups.receive',
    target_branch_id
  );
$$;

revoke all on function public.can_receive_pastoral_followups(uuid,uuid) from public;
grant execute on function public.can_receive_pastoral_followups(uuid,uuid) to authenticated;

drop policy if exists follow_ups_ministry_read on public.live_follow_ups;
create policy follow_ups_ministry_read
on public.live_follow_ups for select to authenticated
using(public.can_receive_pastoral_followups(organization_id,branch_id));

create policy follow_ups_ministry_update
on public.live_follow_ups for update to authenticated
using(public.can_receive_pastoral_followups(organization_id,branch_id))
with check(public.can_receive_pastoral_followups(organization_id,branch_id));
