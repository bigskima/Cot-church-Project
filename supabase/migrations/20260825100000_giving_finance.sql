-- Provider-neutral giving, payment attempts, receipts, refunds, and reconciliation.

create type public.campaign_status as enum ('draft','active','paused','completed','archived');
create type public.donation_status as enum ('pending','succeeded','failed','refunded','partially_refunded','cancelled');
create type public.payment_attempt_status as enum ('created','requires_action','processing','succeeded','failed','cancelled');
create type public.refund_status as enum ('requested','processing','succeeded','failed','cancelled');

insert into public.permissions(code,name,description,category) values
 ('giving.read','View personal giving','View personal donations and receipts.','giving'),
 ('giving.campaigns.manage','Manage giving campaigns','Create and administer giving campaigns.','giving'),
 ('giving.finance.read','View finance records','View organization donations, receipts, and reconciliation.','finance'),
 ('giving.refunds.manage','Manage refunds','Request and process donation refunds.','finance'),
 ('giving.reconcile','Reconcile payments','Operate provider reconciliation workflows.','finance')
on conflict(code) do update set name=excluded.name,description=excluded.description,category=excluded.category,is_active=true;

create table public.giving_campaigns(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 branch_id uuid, name text not null check(char_length(trim(name)) between 1 and 180), description text not null default '',
 status public.campaign_status not null default 'draft', currency char(3) not null check(currency=upper(currency)), goal_amount_minor bigint check(goal_amount_minor is null or goal_amount_minor>0),
 starts_at timestamptz, ends_at timestamptz, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,organization_id), foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete restrict, check(ends_at is null or starts_at is null or ends_at>starts_at)
);
create table public.donations(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 branch_id uuid, campaign_id uuid, donor_profile_id uuid references public.profiles(id) on delete set null,
 amount_minor bigint not null check(amount_minor>0), currency char(3) not null check(currency=upper(currency)), status public.donation_status not null default 'pending',
 anonymous boolean not null default false, donor_note text not null default '', external_reference text, succeeded_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id),
 foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete restrict,
 foreign key(campaign_id,organization_id) references public.giving_campaigns(id,organization_id) on delete restrict
);
create table public.payment_attempts(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 donation_id uuid not null, provider text not null, provider_payment_id text, idempotency_key text not null,
 amount_minor bigint not null check(amount_minor>0), currency char(3) not null, status public.payment_attempt_status not null default 'created',
 checkout_data jsonb not null default '{}'::jsonb check(jsonb_typeof(checkout_data)='object'), failure_code text, failure_message text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(donation_id,organization_id) references public.donations(id,organization_id) on delete restrict,
 unique(provider,provider_payment_id), unique(provider,idempotency_key), unique(id,organization_id)
);
create table public.payment_provider_events(
 id bigint generated always as identity primary key, provider text not null, provider_event_id text not null,
 event_type text not null, signature_verified boolean not null, payload_sha256 text not null, payload jsonb not null check(jsonb_typeof(payload)='object'),
 processing_error text, processed_at timestamptz, received_at timestamptz not null default now(), unique(provider,provider_event_id)
);
create table public.refunds(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 donation_id uuid not null, payment_attempt_id uuid not null, amount_minor bigint not null check(amount_minor>0), currency char(3) not null,
 status public.refund_status not null default 'requested', reason text not null, provider_refund_id text,
 requested_by uuid not null references public.profiles(id), requested_at timestamptz not null default now(), processed_at timestamptz,
 foreign key(donation_id,organization_id) references public.donations(id,organization_id) on delete restrict,
 foreign key(payment_attempt_id,organization_id) references public.payment_attempts(id,organization_id) on delete restrict,
 unique(provider_refund_id)
);
create sequence public.receipt_number_seq;
create table public.receipts(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
 donation_id uuid not null, receipt_number text not null unique, issued_to_profile_id uuid references public.profiles(id) on delete set null,
 amount_minor bigint not null, currency char(3) not null, issued_at timestamptz not null default now(), voided_at timestamptz, void_reason text,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'), foreign key(donation_id,organization_id) references public.donations(id,organization_id) on delete restrict,
 unique(donation_id)
);
create table public.reconciliation_entries(
 id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete restrict,
 provider text not null, settlement_reference text not null, payment_attempt_id uuid, gross_amount_minor bigint not null,
 fee_amount_minor bigint not null default 0, net_amount_minor bigint not null, currency char(3) not null, settled_at timestamptz not null,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 foreign key(payment_attempt_id,organization_id) references public.payment_attempts(id,organization_id) on delete restrict,
 unique(provider,settlement_reference)
);

create index campaigns_active_idx on public.giving_campaigns(organization_id,branch_id,status);
create index donations_donor_idx on public.donations(donor_profile_id,created_at desc);
create index donations_finance_idx on public.donations(organization_id,status,created_at desc);
create index payment_attempts_donation_idx on public.payment_attempts(donation_id,created_at desc);
create index provider_events_pending_idx on public.payment_provider_events(received_at) where processed_at is null;
create index reconciliation_tenant_date_idx on public.reconciliation_entries(organization_id,settled_at desc);
create trigger campaigns_updated before update on public.giving_campaigns for each row execute function public.set_updated_at();
create trigger donations_updated before update on public.donations for each row execute function public.set_updated_at();
create trigger payment_attempts_updated before update on public.payment_attempts for each row execute function public.set_updated_at();

alter table public.giving_campaigns enable row level security; alter table public.donations enable row level security;
alter table public.payment_attempts enable row level security; alter table public.payment_provider_events enable row level security;
alter table public.refunds enable row level security; alter table public.receipts enable row level security; alter table public.reconciliation_entries enable row level security;
create policy campaigns_member_read on public.giving_campaigns for select to authenticated using(public.is_organization_member(organization_id) and status in('active','completed'));
create policy campaigns_manage on public.giving_campaigns for all to authenticated using(public.has_permission(organization_id,'giving.campaigns.manage',branch_id)) with check(public.has_permission(organization_id,'giving.campaigns.manage',branch_id));
create policy donations_donor_read on public.donations for select to authenticated using(donor_profile_id=auth.uid());
create policy donations_finance_read on public.donations for select to authenticated using(public.has_permission(organization_id,'giving.finance.read',branch_id));
create policy attempts_donor_read on public.payment_attempts for select to authenticated using(exists(select 1 from public.donations d where d.id=donation_id and d.donor_profile_id=auth.uid()));
create policy attempts_finance_read on public.payment_attempts for select to authenticated using(public.has_permission(organization_id,'giving.finance.read'));
create policy refunds_donor_read on public.refunds for select to authenticated using(exists(select 1 from public.donations d where d.id=donation_id and d.donor_profile_id=auth.uid()));
create policy refunds_finance_read on public.refunds for select to authenticated using(public.has_permission(organization_id,'giving.finance.read'));
create policy receipts_owner_read on public.receipts for select to authenticated using(issued_to_profile_id=auth.uid());
create policy receipts_finance_read on public.receipts for select to authenticated using(public.has_permission(organization_id,'giving.finance.read'));
create policy reconciliation_finance_read on public.reconciliation_entries for select to authenticated using(public.has_permission(organization_id,'giving.reconcile'));

create function public.create_donation_intent(target_organization_id uuid,target_branch_id uuid,target_campaign_id uuid,target_amount_minor bigint,target_currency text,target_provider text,target_idempotency_key text,make_anonymous boolean default false,donor_message text default '')
returns table(donation_id uuid,payment_attempt_id uuid,status public.payment_attempt_status) language plpgsql security definer set search_path='' as $$
declare campaign public.giving_campaigns; donation_id_value uuid; attempt_id_value uuid; existing public.payment_attempts; begin
 if auth.uid() is null or not public.is_organization_member(target_organization_id) then raise exception using errcode='42501',message='Active membership required'; end if;
 if target_amount_minor<=0 or target_amount_minor>100000000000 or target_currency!~'^[A-Z]{3}$' or char_length(target_provider) not between 2 and 50 or target_idempotency_key!~'^[A-Za-z0-9._:-]{8,128}$' then raise exception using errcode='22023',message='Invalid donation intent'; end if;
 if target_campaign_id is not null then select * into campaign from public.giving_campaigns where id=target_campaign_id and organization_id=target_organization_id and status='active'; if not found then raise exception using errcode='P0002',message='Campaign not found'; end if; if campaign.currency<>target_currency then raise exception using errcode='22023',message='Campaign currency mismatch'; end if; end if;
 select * into existing from public.payment_attempts where provider=target_provider and idempotency_key=target_idempotency_key;
 if found then if existing.amount_minor<>target_amount_minor or existing.currency<>target_currency then raise exception using errcode='23514',message='Idempotency key conflict'; end if; return query select existing.donation_id,existing.id,existing.status; return; end if;
 insert into public.donations(organization_id,branch_id,campaign_id,donor_profile_id,amount_minor,currency,anonymous,donor_note) values(target_organization_id,target_branch_id,target_campaign_id,auth.uid(),target_amount_minor,target_currency,make_anonymous,left(coalesce(donor_message,''),1000)) returning id into donation_id_value;
 insert into public.payment_attempts(organization_id,donation_id,provider,idempotency_key,amount_minor,currency) values(target_organization_id,donation_id_value,target_provider,target_idempotency_key,target_amount_minor,target_currency) returning id into attempt_id_value;
 return query select donation_id_value,attempt_id_value,'created'::public.payment_attempt_status; end; $$;

create function public.process_payment_result(target_provider text,target_event_id text,target_event_type text,target_payment_attempt_id uuid,target_provider_payment_id text,result_status public.payment_attempt_status,event_payload jsonb,event_payload_sha256 text)
returns public.donations language plpgsql security definer set search_path='' as $$ declare attempt public.payment_attempts; donation public.donations; begin
 insert into public.payment_provider_events(provider,provider_event_id,event_type,signature_verified,payload_sha256,payload) values(target_provider,target_event_id,target_event_type,true,event_payload_sha256,event_payload) on conflict(provider,provider_event_id) do nothing;
 if not found then select d.* into donation from public.donations d join public.payment_attempts p on p.donation_id=d.id where p.id=target_payment_attempt_id; return donation; end if;
 select * into attempt from public.payment_attempts where id=target_payment_attempt_id for update; if not found or attempt.provider<>target_provider then raise exception using errcode='P0002',message='Payment attempt not found'; end if;
 update public.payment_attempts set provider_payment_id=target_provider_payment_id,status=result_status,failure_message=case when result_status='failed' then 'Provider reported failure' end where id=attempt.id;
 update public.donations set status=case result_status when 'succeeded' then 'succeeded'::public.donation_status when 'failed' then 'failed'::public.donation_status when 'cancelled' then 'cancelled'::public.donation_status else status end,succeeded_at=case when result_status='succeeded' then now() else succeeded_at end where id=attempt.donation_id returning * into donation;
 if result_status='succeeded' then insert into public.receipts(organization_id,donation_id,receipt_number,issued_to_profile_id,amount_minor,currency,snapshot) values(donation.organization_id,donation.id,to_char(now(),'YYYY')||'-'||lpad(nextval('public.receipt_number_seq')::text,10,'0'),donation.donor_profile_id,donation.amount_minor,donation.currency,jsonb_build_object('donationId',donation.id,'amountMinor',donation.amount_minor,'currency',donation.currency,'issuedAt',now())) on conflict(donation_id) do nothing; end if;
update public.payment_provider_events set processed_at=now() where provider=target_provider and provider_event_id=target_event_id; return donation; end; $$;

create function public.request_donation_refund(target_donation_id uuid,target_amount_minor bigint,refund_reason text)
returns public.refunds language plpgsql security definer set search_path='' as $$ declare donation public.donations; attempt public.payment_attempts; refunded bigint; result public.refunds; begin
 select * into donation from public.donations where id=target_donation_id for update; if not found then raise exception using errcode='P0002',message='Donation not found'; end if;
 if not public.has_permission(donation.organization_id,'giving.refunds.manage',donation.branch_id) then raise exception using errcode='42501',message='Permission denied'; end if;
 if donation.status not in('succeeded','partially_refunded') then raise exception using errcode='22023',message='Donation is not refundable'; end if;
 select coalesce(sum(amount_minor) filter(where status in('requested','processing','succeeded')),0) into refunded from public.refunds where donation_id=donation.id;
 if target_amount_minor<=0 or refunded+target_amount_minor>donation.amount_minor then raise exception using errcode='23514',message='Refund exceeds refundable amount'; end if;
 select * into attempt from public.payment_attempts where donation_id=donation.id and status='succeeded' order by created_at desc limit 1; if not found then raise exception using errcode='P0002',message='Successful payment not found'; end if;
 insert into public.refunds(organization_id,donation_id,payment_attempt_id,amount_minor,currency,reason,requested_by) values(donation.organization_id,donation.id,attempt.id,target_amount_minor,donation.currency,left(trim(refund_reason),1000),auth.uid()) returning * into result; return result; end; $$;

create function public.giving_summary(target_organization_id uuid,period_start timestamptz,period_end timestamptz,target_branch_id uuid default null)
returns table(currency char(3),donation_count bigint,total_amount_minor numeric,refunded_amount_minor numeric) language plpgsql security definer set search_path='' as $$ begin
 if period_end<=period_start or period_end-period_start>interval '5 years' then raise exception using errcode='22023',message='Invalid report period'; end if;
 if not public.has_permission(target_organization_id,'giving.finance.read',target_branch_id) then raise exception using errcode='42501',message='Permission denied'; end if;
 return query select d.currency,count(*),sum(d.amount_minor),coalesce(sum((select sum(r.amount_minor) from public.refunds r where r.donation_id=d.id and r.status='succeeded')),0) from public.donations d where d.organization_id=target_organization_id and d.created_at>=period_start and d.created_at<period_end and d.status in('succeeded','refunded','partially_refunded') and (target_branch_id is null or d.branch_id=target_branch_id) group by d.currency; end; $$;

revoke all on function public.create_donation_intent(uuid,uuid,uuid,bigint,text,text,text,boolean,text) from public;
revoke all on function public.process_payment_result(text,text,text,uuid,text,public.payment_attempt_status,jsonb,text) from public;
revoke all on function public.request_donation_refund(uuid,bigint,text) from public;
revoke all on function public.giving_summary(uuid,timestamptz,timestamptz,uuid) from public;
grant execute on function public.create_donation_intent(uuid,uuid,uuid,bigint,text,text,text,boolean,text) to authenticated;
grant execute on function public.process_payment_result(text,text,text,uuid,text,public.payment_attempt_status,jsonb,text) to service_role;
grant execute on function public.request_donation_refund(uuid,bigint,text) to authenticated;
grant execute on function public.giving_summary(uuid,timestamptz,timestamptz,uuid) to authenticated;
create trigger audit_campaigns after insert or update or delete on public.giving_campaigns for each row execute function public.audit_row_change();
create trigger audit_donations after insert or update or delete on public.donations for each row execute function public.audit_row_change();
create trigger audit_refunds after insert or update or delete on public.refunds for each row execute function public.audit_row_change();
