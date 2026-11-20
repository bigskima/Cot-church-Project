-- Restore giving operations to church-scoped roles.
-- Platform Administration remains responsible for payment infrastructure,
-- safety, provider configuration and platform governance, not routine church giving.

delete from public.platform_role_permissions
where permission_code in ('platform.giving.read', 'platform.giving.manage');

update public.permissions
set is_active = false
where code in ('platform.giving.read', 'platform.giving.manage');

drop policy if exists giving_campaigns_expression_manage on public.giving_campaigns;
drop policy if exists campaigns_manage on public.giving_campaigns;
create policy giving_campaigns_manage on public.giving_campaigns
for all to authenticated
using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id))
with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));

drop policy if exists giving_settings_expression_manage on public.giving_settings;
create policy giving_settings_manage on public.giving_settings
for all to authenticated
using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id))
with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));

drop policy if exists giving_purposes_expression_manage on public.giving_purposes;
create policy giving_purposes_manage on public.giving_purposes
for all to authenticated
using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id))
with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));

drop policy if exists bank_accounts_expression_manage on public.organization_bank_accounts;
drop policy if exists bank_accounts_manage on public.organization_bank_accounts;
create policy bank_accounts_manage on public.organization_bank_accounts
for all to authenticated
using (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id))
with check (public.has_permission(organization_id, 'giving.campaigns.manage', branch_id));

comment on policy giving_campaigns_manage on public.giving_campaigns is
  'Church roles with giving.campaigns.manage may manage the exact organization or Expression scope granted to them.';
comment on policy giving_settings_manage on public.giving_settings is
  'Church roles manage giving presentation at their exact organization or Expression scope.';
comment on policy giving_purposes_manage on public.giving_purposes is
  'Church roles manage giving purposes at their exact organization or Expression scope.';
comment on policy bank_accounts_manage on public.organization_bank_accounts is
  'Church roles manage transfer destinations at their exact organization or Expression scope.';
