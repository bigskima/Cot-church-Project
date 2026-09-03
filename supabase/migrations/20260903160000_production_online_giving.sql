-- Production online-giving ledger linkage and service-only intent creation.

alter table public.giving_purposes
  add constraint giving_purposes_id_organization_uq unique(id,organization_id);

alter table public.donations
  add column if not exists purpose_id uuid;

alter table public.donations
  drop constraint if exists donations_purpose_scope_fk;
alter table public.donations
  add constraint donations_purpose_scope_fk
  foreign key(purpose_id,organization_id)
  references public.giving_purposes(id,organization_id)
  on delete restrict;

create index if not exists donations_purpose_idx
  on public.donations(organization_id,branch_id,purpose_id,created_at desc)
  where purpose_id is not null;

create or replace function public.create_online_donation_intent(
  target_profile_id uuid,
  target_organization_id uuid,
  target_branch_id uuid,
  target_purpose_id uuid,
  target_campaign_id uuid,
  target_amount_minor bigint,
  target_currency text,
  target_provider text,
  target_idempotency_key text,
  make_anonymous boolean default false,
  donor_message text default ''
)
returns table(donation_id uuid,payment_attempt_id uuid,status public.payment_attempt_status)
language plpgsql
security definer
set search_path=''
as $$
declare
  purpose public.giving_purposes;
  campaign public.giving_campaigns;
  existing public.payment_attempts;
  existing_donation public.donations;
  donation_id_value uuid;
  attempt_id_value uuid;
begin
  if target_profile_id is null or target_organization_id is null then
    raise exception using errcode='22023',message='Member and organization are required';
  end if;
  if not exists(
    select 1 from public.memberships m
    where m.organization_id=target_organization_id
      and m.profile_id=target_profile_id
      and m.status='active'
      and (target_branch_id is null or m.branch_id=target_branch_id)
  ) then
    raise exception using errcode='42501',message='Active membership in the selected giving scope is required';
  end if;
  if target_amount_minor<=0 or target_amount_minor>100000000000
     or target_currency!~'^[A-Z]{3}$'
     or char_length(target_provider) not between 2 and 50
     or target_idempotency_key!~'^[A-Za-z0-9._:-]{8,128}$' then
    raise exception using errcode='22023',message='Invalid donation intent';
  end if;

  if target_purpose_id is not null then
    select * into purpose
    from public.giving_purposes
    where id=target_purpose_id
      and organization_id=target_organization_id
      and branch_id is not distinct from target_branch_id
      and status='active';
    if not found then raise exception using errcode='P0002',message='Giving purpose not found in selected scope'; end if;
  end if;

  if target_campaign_id is not null then
    select * into campaign
    from public.giving_campaigns
    where id=target_campaign_id
      and organization_id=target_organization_id
      and branch_id is not distinct from target_branch_id
      and status='active';
    if not found then raise exception using errcode='P0002',message='Campaign not found in selected scope'; end if;
    if campaign.currency<>target_currency then raise exception using errcode='22023',message='Campaign currency mismatch'; end if;
  end if;

  select * into existing
  from public.payment_attempts
  where provider=target_provider and idempotency_key=target_idempotency_key;
  if found then
    select * into existing_donation from public.donations where id=existing.donation_id;
    if existing.organization_id<>target_organization_id
       or existing.amount_minor<>target_amount_minor
       or existing.currency<>target_currency
       or existing_donation.donor_profile_id is distinct from target_profile_id
       or existing_donation.branch_id is distinct from target_branch_id
       or existing_donation.purpose_id is distinct from target_purpose_id
       or existing_donation.campaign_id is distinct from target_campaign_id then
      raise exception using errcode='23514',message='Idempotency key conflict';
    end if;
    return query select existing.donation_id,existing.id,existing.status;
    return;
  end if;

  insert into public.donations(
    organization_id,branch_id,purpose_id,campaign_id,donor_profile_id,
    amount_minor,currency,anonymous,donor_note
  ) values(
    target_organization_id,target_branch_id,target_purpose_id,target_campaign_id,target_profile_id,
    target_amount_minor,target_currency,make_anonymous,left(coalesce(donor_message,''),1000)
  ) returning id into donation_id_value;

  insert into public.payment_attempts(
    organization_id,donation_id,provider,idempotency_key,amount_minor,currency
  ) values(
    target_organization_id,donation_id_value,target_provider,target_idempotency_key,target_amount_minor,target_currency
  ) returning id into attempt_id_value;

  return query select donation_id_value,attempt_id_value,'created'::public.payment_attempt_status;
end;
$$;

revoke all on function public.create_online_donation_intent(uuid,uuid,uuid,uuid,uuid,bigint,text,text,text,boolean,text) from public;
grant execute on function public.create_online_donation_intent(uuid,uuid,uuid,uuid,uuid,bigint,text,text,text,boolean,text) to service_role;
