-- Public giving must be resolved through the tenant-scoped public-giving Edge Function.
-- This prevents direct anonymous reads from accidentally crossing organization scopes.

drop policy if exists bank_accounts_public_read on public.organization_bank_accounts;
drop policy if exists giving_settings_public_read on public.giving_settings;
drop policy if exists giving_purposes_public_read on public.giving_purposes;
drop policy if exists campaigns_public_read on public.giving_campaigns;

-- Authenticated organization/expression users retain scoped reads where appropriate.
create policy bank_accounts_authenticated_scoped_read on public.organization_bank_accounts
for select to authenticated
using (
  is_public = true
  and is_active = true
  and public.is_organization_member(organization_id)
);

create policy giving_settings_authenticated_scoped_read on public.giving_settings
for select to authenticated
using (
  public.is_organization_member(organization_id)
);

create policy giving_purposes_authenticated_scoped_read on public.giving_purposes
for select to authenticated
using (
  status = 'active'
  and public.is_organization_member(organization_id)
);

create policy giving_campaigns_authenticated_scoped_read on public.giving_campaigns
for select to authenticated
using (
  status in ('active', 'completed')
  and public.is_organization_member(organization_id)
);

comment on table public.organization_bank_accounts is
  'Manual transfer destinations. Anonymous exposure is mediated by public-giving so tenant/expression scope is explicit.';
