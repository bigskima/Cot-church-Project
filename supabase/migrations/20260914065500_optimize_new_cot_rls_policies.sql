-- Keep the Sep 14 RLS contract identical while avoiding overlapping SELECT
-- policies and per-row auth.uid() evaluation on the new participation/ministry
-- tables. Mutation permissions are expressed explicitly by operation.

-- Polls: managers mutate; visibility remains governed by polls_read.
drop policy if exists polls_manage on public.polls;
create policy polls_manage_insert on public.polls
for insert to authenticated
with check (
  author_profile_id = (select auth.uid())
  and public.has_permission(organization_id, 'polls.manage', branch_id)
);
create policy polls_manage_update on public.polls
for update to authenticated
using (public.has_permission(organization_id, 'polls.manage', branch_id))
with check (
  author_profile_id = (select auth.uid())
  and public.has_permission(organization_id, 'polls.manage', branch_id)
);
create policy polls_manage_delete on public.polls
for delete to authenticated
using (public.has_permission(organization_id, 'polls.manage', branch_id));

drop policy if exists polls_read on public.polls;
create policy polls_read on public.polls
for select to public
using (
  (
    status in ('open', 'closed')
    and (
      (branch_id is null and (visibility = 'public' or public.is_organization_member(organization_id)))
      or (branch_id is not null and public.is_expression_member(organization_id, branch_id))
    )
  )
  or author_profile_id = (select auth.uid())
  or public.has_permission(organization_id, 'polls.manage', branch_id)
);

-- Poll options: public/scoped read remains separate from manager mutations.
drop policy if exists poll_options_manage on public.poll_options;
create policy poll_options_manage_insert on public.poll_options
for insert to authenticated
with check (
  exists (
    select 1 from public.polls p
    where p.id = poll_id
      and public.has_permission(p.organization_id, 'polls.manage', p.branch_id)
  )
);
create policy poll_options_manage_update on public.poll_options
for update to authenticated
using (
  exists (
    select 1 from public.polls p
    where p.id = poll_id
      and public.has_permission(p.organization_id, 'polls.manage', p.branch_id)
  )
)
with check (
  exists (
    select 1 from public.polls p
    where p.id = poll_id
      and public.has_permission(p.organization_id, 'polls.manage', p.branch_id)
  )
);
create policy poll_options_manage_delete on public.poll_options
for delete to authenticated
using (
  exists (
    select 1 from public.polls p
    where p.id = poll_id
      and public.has_permission(p.organization_id, 'polls.manage', p.branch_id)
  )
);

-- Poll votes: raw identities are self/manager readable. Voting itself is only
-- INSERT + DELETE because vote_community_poll atomically replaces selections.
drop policy if exists poll_votes_own on public.poll_votes;
drop policy if exists poll_votes_read on public.poll_votes;
create policy poll_votes_read on public.poll_votes
for select to authenticated
using (
  profile_id = (select auth.uid())
  or exists (
    select 1 from public.polls p
    where p.id = poll_id
      and public.has_permission(p.organization_id, 'polls.manage', p.branch_id)
  )
);
create policy poll_votes_insert_own on public.poll_votes
for insert to authenticated
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
create policy poll_votes_delete_own on public.poll_votes
for delete to authenticated
using (profile_id = (select auth.uid()));

-- Giveaways.
drop policy if exists giveaways_create on public.giveaways;
create policy giveaways_create on public.giveaways
for insert to authenticated
with check (
  host_profile_id = (select auth.uid())
  and (
    (
      branch_id is null
      and visibility = 'public'
      and exists (
        select 1 from public.organizations o
        where o.id = organization_id and o.status = 'active'
      )
    )
    or (branch_id is null and public.is_organization_member(organization_id))
    or (branch_id is not null and public.is_expression_member(organization_id, branch_id))
  )
);

drop policy if exists giveaways_host_update on public.giveaways;
create policy giveaways_host_update on public.giveaways
for update to authenticated
using (host_profile_id = (select auth.uid()))
with check (
  host_profile_id = (select auth.uid())
  and status not in ('drawing', 'completed')
  and (
    (branch_id is null and (visibility = 'public' or public.is_organization_member(organization_id)))
    or (branch_id is not null and public.is_expression_member(organization_id, branch_id))
  )
);

drop policy if exists giveaways_read on public.giveaways;
create policy giveaways_read on public.giveaways
for select to public
using (
  (
    status in ('open', 'drawing', 'completed')
    and (
      (branch_id is null and (visibility = 'public' or public.is_organization_member(organization_id)))
      or (branch_id is not null and public.is_expression_member(organization_id, branch_id))
    )
  )
  or host_profile_id = (select auth.uid())
);

drop policy if exists giveaway_entries_own on public.giveaway_entries;
create policy giveaway_entries_own on public.giveaway_entries
for insert to authenticated
with check (
  profile_id = (select auth.uid())
  and exists (
    select 1 from public.giveaways g
    where g.id = giveaway_id
      and g.status = 'open'
      and (g.opens_at is null or g.opens_at <= now())
      and (g.closes_at is null or g.closes_at > now())
      and (
        (g.branch_id is null and (g.visibility = 'public' or public.is_organization_member(g.organization_id)))
        or (g.branch_id is not null and public.is_expression_member(g.organization_id, g.branch_id))
      )
  )
);

drop policy if exists giveaway_entries_read on public.giveaway_entries;
create policy giveaway_entries_read on public.giveaway_entries
for select to authenticated
using (
  profile_id = (select auth.uid())
  or exists (
    select 1 from public.giveaways g
    where g.id = giveaway_id and g.host_profile_id = (select auth.uid())
  )
);

-- Testimony workflow.
drop policy if exists testimonies_private_read on public.testimonies;
create policy testimonies_private_read on public.testimonies
for select to authenticated
using (
  author_profile_id = (select auth.uid())
  or public.has_permission(organization_id, 'testimonies.review', branch_id)
  or public.has_permission(organization_id, 'testimonies.manage', branch_id)
);

drop policy if exists testimonies_submit on public.testimonies;
create policy testimonies_submit on public.testimonies
for insert to authenticated
with check (
  author_profile_id = (select auth.uid())
  and public.is_expression_member(organization_id, branch_id)
);

-- Author/staff updates are combined into one permissive policy to avoid evaluating
-- two separate policies for every update while preserving both authorization paths.
drop policy if exists testimonies_author_draft_update on public.testimonies;
drop policy if exists testimonies_staff_update on public.testimonies;
create policy testimonies_update on public.testimonies
for update to authenticated
using (
  (
    author_profile_id = (select auth.uid())
    and status in ('draft', 'submitted')
  )
  or public.has_permission(organization_id, 'testimonies.manage', branch_id)
)
with check (
  author_profile_id = (select auth.uid())
  or public.has_permission(organization_id, 'testimonies.manage', branch_id)
);

drop policy if exists testimony_responses_read on public.testimony_responses;
create policy testimony_responses_read on public.testimony_responses
for select to authenticated
using (
  exists (
    select 1 from public.testimonies t
    where t.id = testimony_id
      and (
        t.author_profile_id = (select auth.uid())
        or public.has_permission(t.organization_id, 'testimonies.review', t.branch_id)
        or public.has_permission(t.organization_id, 'testimonies.manage', t.branch_id)
      )
  )
);

drop policy if exists testimony_responses_staff on public.testimony_responses;
create policy testimony_responses_staff on public.testimony_responses
for insert to authenticated
with check (
  responder_profile_id = (select auth.uid())
  and exists (
    select 1 from public.testimonies t
    where t.id = testimony_id
      and (
        public.has_permission(t.organization_id, 'testimonies.review', t.branch_id)
        or public.has_permission(t.organization_id, 'testimonies.manage', t.branch_id)
      )
  )
);

-- Finance: separate manager mutations from read policies to avoid duplicate SELECT
-- policy evaluation; ledger entry identity uses an init-plan-safe auth lookup.
drop policy if exists financial_accounts_manage on public.financial_accounts;
create policy financial_accounts_manage_insert on public.financial_accounts
for insert to authenticated
with check (
  branch_id is not null and public.has_permission(organization_id, 'finance.manage', branch_id)
);
create policy financial_accounts_manage_update on public.financial_accounts
for update to authenticated
using (branch_id is not null and public.has_permission(organization_id, 'finance.manage', branch_id))
with check (branch_id is not null and public.has_permission(organization_id, 'finance.manage', branch_id));
create policy financial_accounts_manage_delete on public.financial_accounts
for delete to authenticated
using (branch_id is not null and public.has_permission(organization_id, 'finance.manage', branch_id));

drop policy if exists financial_sessions_manage on public.financial_sessions;
create policy financial_sessions_manage_insert on public.financial_sessions
for insert to authenticated
with check (public.has_permission(organization_id, 'finance.manage', branch_id));
create policy financial_sessions_manage_update on public.financial_sessions
for update to authenticated
using (public.has_permission(organization_id, 'finance.manage', branch_id))
with check (public.has_permission(organization_id, 'finance.manage', branch_id));
create policy financial_sessions_manage_delete on public.financial_sessions
for delete to authenticated
using (public.has_permission(organization_id, 'finance.manage', branch_id));

drop policy if exists financial_ledger_insert on public.financial_ledger_entries;
create policy financial_ledger_insert on public.financial_ledger_entries
for insert to authenticated
with check (
  branch_id is not null
  and recorded_by = (select auth.uid())
  and public.has_permission(organization_id, 'finance.manage', branch_id)
);
