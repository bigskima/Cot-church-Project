-- Authenticated Group members can create donation intents only for giving
-- purposes explicitly enabled by that Group. The gift keeps both Expression
-- and Group identity while using the existing provider-neutral payment rails.

create or replace function public.create_group_donation_intent(
  target_organization_id uuid,
  target_branch_id uuid,
  target_group_id uuid,
  target_purpose_id uuid,
  target_campaign_id uuid,
  target_amount_minor bigint,
  target_currency text,
  target_provider text,
  target_idempotency_key text,
  make_anonymous boolean default false,
  donor_message text default ''
)
returns table(
  donation_id uuid,
  payment_attempt_id uuid,
  status public.payment_attempt_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_profile_id uuid := auth.uid();
  selected_group public.groups;
  selected_purpose public.giving_purposes;
  selected_campaign public.giving_campaigns;
  existing public.payment_attempts;
  existing_donation public.donations;
  donation_id_value uuid;
  attempt_id_value uuid;
begin
  if target_profile_id is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  if target_branch_id is null or target_group_id is null or target_purpose_id is null then
    raise exception using errcode='22023', message='Expression, Group and giving purpose are required';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.organization_id = target_organization_id
      and m.profile_id = target_profile_id
      and m.status = 'active'
  ) then
    raise exception using errcode='42501', message='Active church membership required';
  end if;

  select g.* into selected_group
  from public.groups g
  where g.id = target_group_id
    and g.organization_id = target_organization_id
    and g.branch_id = target_branch_id
    and g.is_active = true;

  if not found then
    raise exception using errcode='P0002', message='Group giving scope is unavailable';
  end if;

  if not exists (
    select 1
    from public.group_memberships gm
    join public.memberships m
      on m.id = gm.membership_id
     and m.organization_id = gm.organization_id
     and m.status = 'active'
    where gm.group_id = target_group_id
      and gm.organization_id = target_organization_id
      and gm.status = 'active'
      and gm.banned_at is null
      and m.profile_id = target_profile_id
  ) then
    raise exception using errcode='42501', message='Join this Group before giving through it';
  end if;

  select gp.* into selected_purpose
  from public.giving_purposes gp
  join public.group_giving_options ggo
    on ggo.giving_purpose_id = gp.id
   and ggo.organization_id = gp.organization_id
   and ggo.group_id = target_group_id
   and ggo.is_active = true
  where gp.id = target_purpose_id
    and gp.organization_id = target_organization_id
    and gp.branch_id = target_branch_id
    and gp.status = 'active';

  if not found then
    raise exception using errcode='P0002', message='This giving purpose is not enabled for the Group';
  end if;

  if target_amount_minor <= 0
     or target_amount_minor > 100000000000
     or target_currency !~ '^[A-Z]{3}$'
     or char_length(target_provider) not between 2 and 50
     or target_idempotency_key !~ '^[A-Za-z0-9._:-]{8,128}$' then
    raise exception using errcode='22023', message='Invalid donation intent';
  end if;

  if target_campaign_id is not null then
    select * into selected_campaign
    from public.giving_campaigns
    where id = target_campaign_id
      and organization_id = target_organization_id
      and branch_id = target_branch_id
      and status = 'active';

    if not found then
      raise exception using errcode='P0002', message='Campaign not found in this Expression';
    end if;

    if selected_campaign.currency <> target_currency then
      raise exception using errcode='22023', message='Campaign currency mismatch';
    end if;
  end if;

  select * into existing
  from public.payment_attempts
  where provider = target_provider
    and idempotency_key = target_idempotency_key;

  if found then
    select * into existing_donation
    from public.donations
    where id = existing.donation_id;

    if existing.organization_id <> target_organization_id
       or existing.amount_minor <> target_amount_minor
       or existing.currency <> target_currency
       or existing_donation.donor_profile_id is distinct from target_profile_id
       or existing_donation.branch_id is distinct from target_branch_id
       or existing_donation.group_id is distinct from target_group_id
       or existing_donation.purpose_id is distinct from target_purpose_id
       or existing_donation.campaign_id is distinct from target_campaign_id then
      raise exception using errcode='23514', message='Idempotency key conflict';
    end if;

    return query
      select existing.donation_id, existing.id, existing.status;
    return;
  end if;

  insert into public.donations(
    organization_id, branch_id, group_id, purpose_id, campaign_id,
    donor_profile_id, amount_minor, currency, anonymous, donor_note
  ) values (
    target_organization_id, target_branch_id, target_group_id, target_purpose_id,
    target_campaign_id, target_profile_id, target_amount_minor, target_currency,
    make_anonymous, left(coalesce(donor_message, ''), 1000)
  )
  returning id into donation_id_value;

  insert into public.payment_attempts(
    organization_id, donation_id, provider, idempotency_key, amount_minor, currency
  ) values (
    target_organization_id, donation_id_value, target_provider,
    target_idempotency_key, target_amount_minor, target_currency
  )
  returning id into attempt_id_value;

  return query
    select donation_id_value, attempt_id_value, 'created'::public.payment_attempt_status;
end;
$$;

revoke all on function public.create_group_donation_intent(
  uuid,uuid,uuid,uuid,uuid,bigint,text,text,text,boolean,text
) from public, anon;

grant execute on function public.create_group_donation_intent(
  uuid,uuid,uuid,uuid,uuid,bigint,text,text,text,boolean,text
) to authenticated, service_role;
