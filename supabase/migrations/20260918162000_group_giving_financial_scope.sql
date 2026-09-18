-- Give donations and ledger entries an exact Group scope while preserving
-- the existing Expression-owned payment and finance rails.

alter table public.donations
  add column if not exists group_id uuid;

alter table public.donations
  drop constraint if exists donations_group_id_organization_id_fkey;

alter table public.donations
  add constraint donations_group_id_organization_id_fkey
  foreign key (group_id, organization_id)
  references public.groups(id, organization_id)
  on delete restrict;

create index if not exists donations_group_scope_idx
  on public.donations(organization_id, branch_id, group_id, created_at desc)
  where group_id is not null;

alter table public.financial_ledger_entries
  add column if not exists group_id uuid;

alter table public.financial_ledger_entries
  drop constraint if exists financial_ledger_entries_group_id_organization_id_fkey;

alter table public.financial_ledger_entries
  add constraint financial_ledger_entries_group_id_organization_id_fkey
  foreign key (group_id, organization_id)
  references public.groups(id, organization_id)
  on delete restrict;

create index if not exists financial_ledger_group_scope_idx
  on public.financial_ledger_entries(organization_id, branch_id, group_id, occurred_at desc)
  where group_id is not null;

create or replace function public.enforce_donation_group_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group public.groups;
begin
  if new.group_id is null then
    return new;
  end if;

  select g.* into target_group
  from public.groups g
  where g.id = new.group_id
    and g.organization_id = new.organization_id
    and g.is_active = true;

  if not found then
    raise exception using errcode='23503', message='Giving Group is unavailable';
  end if;

  if target_group.branch_id is null
     or new.branch_id is distinct from target_group.branch_id then
    raise exception using errcode='23514', message='Group giving must remain inside its Expression';
  end if;

  return new;
end;
$$;

drop trigger if exists donations_group_scope_guard on public.donations;
create trigger donations_group_scope_guard
before insert or update of organization_id, branch_id, group_id
on public.donations
for each row execute function public.enforce_donation_group_scope();

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
    organization_id, branch_id, group_id, account_id, session_id,
    giving_purpose_id, giving_campaign_id, contributor_profile_id,
    contributor_name, direction, amount_minor, currency, entry_kind,
    source_type, source_reference, memo, occurred_at, recorded_by
  ) values (
    new.organization_id, new.branch_id, new.group_id, wallet_id, null,
    new.purpose_id, new.campaign_id, new.donor_profile_id, null,
    'credit', new.amount_minor, new.currency,
    case when new.campaign_id is not null then 'campaign' else 'other' end,
    'online_payment', new.id::text,
    case when new.group_id is not null
      then 'Group giving payment recorded automatically after provider confirmation.'
      else 'Online giving payment recorded automatically after provider confirmation.'
    end,
    coalesce(new.succeeded_at, now()), null
  ) on conflict (organization_id, source_type, source_reference)
    where source_reference is not null and source_type = 'online_payment'
    do nothing;

  return new;
end;
$function$;

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
    organization_id, branch_id, group_id, account_id, session_id,
    giving_purpose_id, giving_campaign_id, contributor_profile_id,
    contributor_name, direction, amount_minor, currency, entry_kind,
    source_type, source_reference, memo, occurred_at, recorded_by
  ) values (
    donation.organization_id, donation.branch_id, donation.group_id,
    wallet_id, null, donation.purpose_id, donation.campaign_id,
    donation.donor_profile_id, null, 'debit', new.amount_minor,
    donation.currency, 'adjustment', 'online_payment',
    'refund:' || new.id::text,
    case when donation.group_id is not null
      then 'Group giving refund recorded automatically after provider confirmation.'
      else 'Online giving refund recorded automatically after provider confirmation.'
    end,
    coalesce(new.processed_at, now()), null
  ) on conflict (organization_id, source_type, source_reference)
    where source_reference is not null and source_type = 'online_payment'
    do nothing;

  return new;
end;
$function$;

revoke all on function public.enforce_donation_group_scope() from public, anon, authenticated, service_role;
revoke all on function public.record_succeeded_donation_in_finance_ledger() from public, anon, authenticated, service_role;
revoke all on function public.record_succeeded_refund_in_finance_ledger() from public, anon, authenticated, service_role;
