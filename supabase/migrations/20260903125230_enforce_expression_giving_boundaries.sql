-- Enforce the giving scope at the database layer as well as API/UI layers.
-- Church-wide rows (branch_id NULL) are readable by active members of the church.
-- Expression rows are readable only by active members of that expression, unless a
-- separate manage policy grants scoped leadership authority.

create or replace function public.can_read_giving_scope(
  target_organization_id uuid,
  target_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when target_branch_id is null then exists (
      select 1
      from public.memberships m
      where m.organization_id = target_organization_id
        and m.profile_id = auth.uid()
        and m.status = 'active'
    )
    else exists (
      select 1
      from public.memberships m
      where m.organization_id = target_organization_id
        and m.profile_id = auth.uid()
        and m.branch_id = target_branch_id
        and m.status = 'active'
    )
  end;
$$;

revoke all on function public.can_read_giving_scope(uuid, uuid) from public;
grant execute on function public.can_read_giving_scope(uuid, uuid) to authenticated;

drop policy if exists campaigns_member_read on public.giving_campaigns;
drop policy if exists giving_campaigns_authenticated_scoped_read on public.giving_campaigns;
drop policy if exists campaigns_manage on public.giving_campaigns;

create policy giving_campaigns_scoped_read on public.giving_campaigns
for select to authenticated
using (
  status in ('active', 'completed')
  and public.can_read_giving_scope(organization_id, branch_id)
);

create policy giving_campaigns_expression_manage on public.giving_campaigns
for all to authenticated
using (
  branch_id is not null
  and public.has_permission(organization_id, 'giving.campaigns.manage', branch_id)
)
with check (
  branch_id is not null
  and public.has_permission(organization_id, 'giving.campaigns.manage', branch_id)
);

drop policy if exists giving_settings_authenticated_scoped_read on public.giving_settings;
create policy giving_settings_authenticated_scoped_read on public.giving_settings
for select to authenticated
using (public.can_read_giving_scope(organization_id, branch_id));

drop policy if exists giving_purposes_authenticated_scoped_read on public.giving_purposes;
create policy giving_purposes_authenticated_scoped_read on public.giving_purposes
for select to authenticated
using (
  status = 'active'
  and public.can_read_giving_scope(organization_id, branch_id)
);

drop policy if exists bank_accounts_authenticated_scoped_read on public.organization_bank_accounts;
create policy bank_accounts_authenticated_scoped_read on public.organization_bank_accounts
for select to authenticated
using (
  is_public = true
  and is_active = true
  and public.can_read_giving_scope(organization_id, branch_id)
);

comment on function public.can_read_giving_scope(uuid, uuid) is
  'Returns true only when the authenticated identity may read the exact church-wide or expression giving scope.';
