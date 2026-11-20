-- Compatibility follow-up for the operation-specific RLS split in 14065500.
-- Preserve every access path that the former FOR ALL policies implicitly granted.

-- finance.manage previously inherited SELECT through the manager FOR ALL policy.
-- Keep a single SELECT policy while allowing either read or manage authority.
drop policy if exists financial_accounts_read on public.financial_accounts;
create policy financial_accounts_read on public.financial_accounts
for select to authenticated
using (
  branch_id is not null
  and (
    public.has_permission(organization_id, 'finance.read', branch_id)
    or public.has_permission(organization_id, 'finance.manage', branch_id)
  )
);

drop policy if exists financial_sessions_read on public.financial_sessions;
create policy financial_sessions_read on public.financial_sessions
for select to authenticated
using (
  public.has_permission(organization_id, 'finance.read', branch_id)
  or public.has_permission(organization_id, 'finance.manage', branch_id)
);

-- The original poll_votes FOR ALL policy also allowed a voter to update their
-- own row while the poll remained open. The main voting RPC uses delete+insert,
-- but retain UPDATE for compatibility with any existing direct client path.
create policy poll_votes_update_own on public.poll_votes
for update to authenticated
using (profile_id = (select auth.uid()))
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1 from public.polls p
    where p.id = poll_id
      and p.status = 'open'
      and (p.closes_at is null or p.closes_at > now())
      and (
        (p.branch_id is null and (p.visibility = 'public' or public.is_organization_member(p.organization_id)))
        or (p.branch_id is not null and public.is_expression_member(p.organization_id, p.branch_id))
      )
  )
);
