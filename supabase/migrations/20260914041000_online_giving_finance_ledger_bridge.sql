-- Bridge provider-neutral online giving into the documentation finance ledger.
-- The payment processor remains the source of truth for money movement; this ledger
-- records the economic event once a canonical donation/refund reaches succeeded.

alter table public.financial_ledger_entries
  alter column recorded_by drop not null;

create or replace function public.ensure_documentation_wallet(
  target_organization_id uuid,
  target_branch_id uuid,
  target_currency char(3),
  target_name text default 'Online giving wallet'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  wallet_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(
    target_organization_id::text || ':' || coalesce(target_branch_id::text, 'general') || ':' || target_currency::text || ':' || target_name
  ));

  select a.id into wallet_id
  from public.financial_accounts a
  where a.organization_id = target_organization_id
    and a.branch_id is not distinct from target_branch_id
    and a.currency = target_currency
    and a.account_type = 'documentation_wallet'
    and a.name = target_name
    and a.status = 'active'
  order by a.created_at
  limit 1;

  if wallet_id is null then
    insert into public.financial_accounts(
      organization_id,
      branch_id,
      name,
      currency,
      account_type,
      status,
      created_by
    ) values (
      target_organization_id,
      target_branch_id,
      target_name,
      target_currency,
      'documentation_wallet',
      'active',
      null
    ) returning id into wallet_id;
  end if;

  return wallet_id;
end;
$function$;

revoke all on function public.ensure_documentation_wallet(uuid,uuid,char,text) from public, anon, authenticated;
grant execute on function public.ensure_documentation_wallet(uuid,uuid,char,text) to service_role;

create or replace function public.record_succeeded_donation_in_finance_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  wallet_id uuid;
begin
  if new.status <> 'succeeded'::public.donation_status
     or (tg_op = 'UPDATE' and old.status = 'succeeded'::public.donation_status) then
    return new;
  end if;

  wallet_id := public.ensure_documentation_wallet(
    new.organization_id,
    new.branch_id,
    new.currency,
    'Online giving wallet'
  );

  insert into public.financial_ledger_entries(
    organization_id,
    branch_id,
    account_id,
    session_id,
    giving_purpose_id,
    giving_campaign_id,
    contributor_profile_id,
    contributor_name,
    direction,
    amount_minor,
    currency,
    entry_kind,
    source_type,
    source_reference,
    memo,
    occurred_at,
    recorded_by
  ) values (
    new.organization_id,
    new.branch_id,
    wallet_id,
    null,
    new.purpose_id,
    new.campaign_id,
    new.donor_profile_id,
    null,
    'credit',
    new.amount_minor,
    new.currency,
    case when new.campaign_id is not null then 'campaign' else 'other' end,
    'online_payment',
    new.id::text,
    'Online giving payment recorded automatically after provider confirmation.',
    coalesce(new.succeeded_at, now()),
    null
  ) on conflict (organization_id, source_type, source_reference)
    where source_reference is not null and source_type = 'online_payment'
    do nothing;

  return new;
end;
$function$;

drop trigger if exists donations_finance_ledger_bridge on public.donations;
create trigger donations_finance_ledger_bridge
after insert or update of status on public.donations
for each row execute function public.record_succeeded_donation_in_finance_ledger();

create or replace function public.record_succeeded_refund_in_finance_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  donation public.donations;
  wallet_id uuid;
begin
  if new.status <> 'succeeded'::public.refund_status
     or (tg_op = 'UPDATE' and old.status = 'succeeded'::public.refund_status) then
    return new;
  end if;

  select d.* into donation
  from public.donations d
  where d.id = new.donation_id;

  if not found then return new; end if;

  wallet_id := public.ensure_documentation_wallet(
    donation.organization_id,
    donation.branch_id,
    donation.currency,
    'Online giving wallet'
  );

  insert into public.financial_ledger_entries(
    organization_id,
    branch_id,
    account_id,
    session_id,
    giving_purpose_id,
    giving_campaign_id,
    contributor_profile_id,
    contributor_name,
    direction,
    amount_minor,
    currency,
    entry_kind,
    source_type,
    source_reference,
    memo,
    occurred_at,
    recorded_by
  ) values (
    donation.organization_id,
    donation.branch_id,
    wallet_id,
    null,
    donation.purpose_id,
    donation.campaign_id,
    donation.donor_profile_id,
    null,
    'debit',
    new.amount_minor,
    donation.currency,
    'adjustment',
    'online_payment',
    'refund:' || new.id::text,
    'Online giving refund recorded automatically after provider confirmation.',
    coalesce(new.processed_at, now()),
    null
  ) on conflict (organization_id, source_type, source_reference)
    where source_reference is not null and source_type = 'online_payment'
    do nothing;

  return new;
end;
$function$;

drop trigger if exists refunds_finance_ledger_bridge on public.refunds;
create trigger refunds_finance_ledger_bridge
after insert or update of status on public.refunds
for each row execute function public.record_succeeded_refund_in_finance_ledger();

comment on function public.record_succeeded_donation_in_finance_ledger() is
  'Provider-neutral bridge from succeeded donations into the documentation ledger. Idempotent by donation id.';
comment on function public.record_succeeded_refund_in_finance_ledger() is
  'Provider-neutral bridge from succeeded refunds into the documentation ledger. Idempotent by refund id.';
