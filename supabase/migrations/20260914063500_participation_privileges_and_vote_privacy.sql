-- Make the September participation/ministry tables independent of legacy implicit
-- Data API grants and keep individual poll votes private while preserving public
-- aggregate poll results through the feed RPC.

-- Start from an explicit deny baseline for browser/mobile roles. RLS remains the
-- row-level authorization boundary on every table below.
revoke all on table
  public.polls,
  public.poll_options,
  public.poll_votes,
  public.giveaways,
  public.giveaway_entries,
  public.giveaway_winners,
  public.testimonies,
  public.testimony_responses,
  public.financial_accounts,
  public.financial_sessions,
  public.financial_ledger_entries
from anon, authenticated;

-- Poll creation/voting RPCs are SECURITY INVOKER, so authenticated callers need
-- the underlying privileges. RLS still limits each operation to its proper scope.
grant select, insert, update, delete on public.polls to authenticated;
grant select, insert, update, delete on public.poll_options to authenticated;
grant select, insert, delete on public.poll_votes to authenticated;

-- Giveaway selection/fulfilment is RPC-only after 20260914062500; clients may
-- create/update the giveaway and enter, but cannot write winner rows directly.
grant select, insert, update on public.giveaways to authenticated;
grant select, insert on public.giveaway_entries to authenticated;
grant select on public.giveaway_winners to authenticated;

-- Expression testimony and finance are authenticated, RLS-protected surfaces.
grant select, insert, update on public.testimonies to authenticated;
grant select, insert on public.testimony_responses to authenticated;
grant select, insert, update, delete on public.financial_accounts to authenticated;
grant select, insert, update, delete on public.financial_sessions to authenticated;
grant select, insert on public.financial_ledger_entries to authenticated;
grant select on public.financial_account_balances to authenticated;

-- A signed-in voter may inspect only their own raw vote rows. Authorized poll
-- managers can inspect rows for polls they administer. Aggregate counts are
-- returned by community_poll_feed without exposing voter identities.
drop policy if exists poll_votes_read on public.poll_votes;
create policy poll_votes_read on public.poll_votes
for select to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.polls p
    where p.id = poll_id
      and public.has_permission(p.organization_id, 'polls.manage', p.branch_id)
  )
);

create or replace function public.community_poll_feed(
  target_organization_id uuid,
  target_branch_id uuid default null
)
returns table(
  id uuid,
  question text,
  description text,
  status text,
  allows_multiple boolean,
  closes_at timestamptz,
  created_at timestamptz,
  author_profile_id uuid,
  options jsonb,
  viewer_has_voted boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p.id,
    p.question,
    p.description,
    p.status,
    p.allows_multiple,
    p.closes_at,
    p.created_at,
    p.author_profile_id,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'label', o.label,
          'displayOrder', o.display_order,
          'votes', (select count(*) from public.poll_votes v where v.poll_id = p.id and v.option_id = o.id),
          'selected', auth.uid() is not null and exists(
            select 1
            from public.poll_votes mine
            where mine.poll_id = p.id
              and mine.option_id = o.id
              and mine.profile_id = auth.uid()
          )
        )
        order by o.display_order, o.created_at
      )
      from public.poll_options o
      where o.poll_id = p.id
    ), '[]'::jsonb) as options,
    auth.uid() is not null and exists(
      select 1
      from public.poll_votes v
      where v.poll_id = p.id and v.profile_id = auth.uid()
    ) as viewer_has_voted
  from public.polls p
  where p.organization_id = target_organization_id
    and p.branch_id is not distinct from target_branch_id
    and p.status in ('open', 'closed')
    and (
      (
        p.branch_id is null
        and (
          p.visibility = 'public'
          or (auth.uid() is not null and public.is_organization_member(p.organization_id))
        )
      )
      or (
        p.branch_id is not null
        and auth.uid() is not null
        and public.is_expression_member(p.organization_id, p.branch_id)
      )
    )
  order by case when p.status = 'open' then 0 else 1 end, p.created_at desc;
$function$;

revoke all on function public.community_poll_feed(uuid, uuid) from public, anon, authenticated;
grant execute on function public.community_poll_feed(uuid, uuid) to anon, authenticated;

-- Remove PostgreSQL's default PUBLIC EXECUTE from mutation functions. These
-- functions still perform their own auth/scope checks in addition to table RLS.
revoke all on function public.create_community_poll(uuid, uuid, text, text, text[], boolean, timestamptz, text) from public, anon;
revoke all on function public.vote_community_poll(uuid, uuid[]) from public, anon;
revoke all on function public.create_community_giveaway(uuid, uuid, text, text, text, integer, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.enter_community_giveaway(uuid) from public, anon;

grant execute on function public.create_community_poll(uuid, uuid, text, text, text[], boolean, timestamptz, text) to authenticated;
grant execute on function public.vote_community_poll(uuid, uuid[]) to authenticated;
grant execute on function public.create_community_giveaway(uuid, uuid, text, text, text, integer, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.enter_community_giveaway(uuid) to authenticated;

comment on function public.community_poll_feed(uuid, uuid) is
  'Returns scope-authorized poll options and aggregate counts without exposing individual voter identities.';
