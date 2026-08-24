-- Phase 1 hardening: invitation lifecycle, API rate limits, and idempotency records.

-- Delivery payloads may contain single-use invitation secrets and are worker-only.
drop policy if exists outbox_admin_read on public.notification_outbox;
drop policy if exists deliveries_admin_read on public.notification_deliveries;

create type public.invitation_status as enum ('pending', 'accepted', 'declined', 'revoked', 'expired');

create table public.membership_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid,
  invited_email text,
  invited_phone text,
  contact_hash text not null,
  token_hash text not null unique,
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contact_hash),
  foreign key (branch_id, organization_id) references public.branches(id, organization_id) on delete restrict,
  check ((invited_email is not null)::integer + (invited_phone is not null)::integer = 1),
  check (expires_at > created_at)
);
create index membership_invitations_pending_idx on public.membership_invitations (organization_id, status, expires_at);
create trigger membership_invitations_updated before update on public.membership_invitations for each row execute function public.set_updated_at();

create table public.api_rate_limits (
  bucket_key text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (bucket_key, subject_hash, window_started_at)
);
create index api_rate_limits_cleanup_idx on public.api_rate_limits (window_started_at);

create table public.api_idempotency_keys (
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  locked_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (actor_profile_id, operation, idempotency_key)
);
create index api_idempotency_expiry_idx on public.api_idempotency_keys (expires_at);

alter table public.membership_invitations enable row level security;
alter table public.api_rate_limits enable row level security;
alter table public.api_idempotency_keys enable row level security;
create policy invitations_admin_read on public.membership_invitations for select to authenticated
using (public.has_permission(organization_id, 'members.invite', branch_id));
create policy idempotency_actor_read on public.api_idempotency_keys for select to authenticated using (actor_profile_id = auth.uid());

create function public.consume_rate_limit(
  rate_bucket text,
  rate_subject_hash text,
  maximum_requests integer,
  window_seconds integer
)
returns table (allowed boolean, remaining integer, resets_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare bucket_start timestamptz; current_count integer;
begin
  if maximum_requests not between 1 and 10000 or window_seconds not between 1 and 86400 or char_length(rate_subject_hash) < 16 then
    raise exception using errcode = '22023', message = 'Invalid rate-limit configuration';
  end if;
  bucket_start := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  insert into public.api_rate_limits(bucket_key, subject_hash, window_started_at, request_count)
  values(rate_bucket, rate_subject_hash, bucket_start, 1)
  on conflict(bucket_key, subject_hash, window_started_at) do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into current_count;
  return query select current_count <= maximum_requests, greatest(maximum_requests - current_count, 0), bucket_start + make_interval(secs => window_seconds);
end; $$;

create function public.reserve_api_idempotency(target_organization_id uuid, target_operation text, target_key text, target_request_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare existing public.api_idempotency_keys; begin
 if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
 if target_key !~ '^[A-Za-z0-9._:-]{8,128}$' or char_length(target_operation) not between 1 and 100 or target_request_hash !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023',message='Invalid idempotency parameters'; end if;
 delete from public.api_idempotency_keys where actor_profile_id=auth.uid() and operation=target_operation and idempotency_key=target_key and expires_at<=now();
 insert into public.api_idempotency_keys(organization_id,actor_profile_id,operation,idempotency_key,request_hash) values(target_organization_id,auth.uid(),target_operation,target_key,target_request_hash) on conflict do nothing;
 select * into existing from public.api_idempotency_keys where actor_profile_id=auth.uid() and operation=target_operation and idempotency_key=target_key for update;
 if existing.request_hash<>target_request_hash then raise exception using errcode='23514',message='Idempotency key was used for a different request'; end if;
 return jsonb_build_object('state',case when existing.completed_at is null then 'reserved' else 'completed' end,'responseStatus',existing.response_status,'responseBody',existing.response_body);
end; $$;

create function public.complete_api_idempotency(target_operation text,target_key text,target_response_status integer,target_response_body jsonb)
returns void language plpgsql security definer set search_path='' as $$ begin
 if target_response_status not between 200 and 599 or jsonb_typeof(target_response_body) is null then raise exception using errcode='22023',message='Invalid idempotency response'; end if;
 update public.api_idempotency_keys set response_status=target_response_status,response_body=target_response_body,completed_at=now()
 where actor_profile_id=auth.uid() and operation=target_operation and idempotency_key=target_key;
 if not found then raise exception using errcode='P0002',message='Idempotency reservation not found'; end if;
end; $$;

create function public.create_membership_invitation(
  target_organization_id uuid,
  target_branch_id uuid,
  target_email text,
  target_phone text,
  validity_hours integer default 72
)
returns table (invitation_id uuid, invitation_token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare normalized_contact text; raw_token text; hashed_contact text; expiration timestamptz; created_id uuid;
begin
  if not public.has_permission(target_organization_id, 'members.invite', target_branch_id) then raise exception using errcode='42501',message='Permission denied'; end if;
  if (target_email is not null)::integer + (target_phone is not null)::integer <> 1 then raise exception using errcode='22023',message='Exactly one contact is required'; end if;
  if validity_hours not between 1 and 168 then raise exception using errcode='22023',message='Invitation validity must be 1-168 hours'; end if;
  normalized_contact := case when target_email is not null then lower(trim(target_email)) else trim(target_phone) end;
  if target_email is not null and normalized_contact !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception using errcode='22023',message='Invalid email'; end if;
  if target_phone is not null and normalized_contact !~ '^\+[1-9][0-9]{7,14}$' then raise exception using errcode='22023',message='Invalid phone number'; end if;
  hashed_contact := encode(extensions.digest(normalized_contact, 'sha256'), 'hex');
  raw_token := encode(extensions.gen_random_bytes(32), 'hex'); expiration := now() + make_interval(hours => validity_hours);
  insert into public.membership_invitations(organization_id,branch_id,invited_email,invited_phone,contact_hash,token_hash,invited_by,expires_at)
  values(target_organization_id,target_branch_id,case when target_email is not null then normalized_contact end,case when target_phone is not null then normalized_contact end,hashed_contact,encode(extensions.digest(raw_token,'sha256'),'hex'),auth.uid(),expiration)
  on conflict(organization_id,contact_hash) do update set branch_id=excluded.branch_id,status='pending',token_hash=excluded.token_hash,invited_by=auth.uid(),expires_at=excluded.expires_at,accepted_by=null,accepted_at=null
  returning id into created_id;
  insert into public.notification_outbox(organization_id,recipient_profile_id,channel,deduplication_key,payload)
  values(target_organization_id,null,case when target_email is not null then 'email'::public.delivery_channel else 'sms'::public.delivery_channel end,
    'membership-invitation:'||created_id, jsonb_build_object('type','membership_invitation','invitationId',created_id,'token',raw_token,'contact',normalized_contact,'expiresAt',expiration))
  on conflict(deduplication_key) do update set payload=excluded.payload,status='pending',attempts=0,available_at=now(),locked_at=null,delivered_at=null,last_error=null;
  return query select created_id,raw_token,expiration;
end; $$;

create function public.accept_membership_invitation(raw_invitation_token text)
returns public.memberships language plpgsql security definer set search_path = '' as $$
declare invitation public.membership_invitations; authenticated_email text; authenticated_phone text; identity_hashes text[]; result public.memberships;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required'; end if;
  select * into invitation from public.membership_invitations where token_hash=encode(extensions.digest(raw_invitation_token,'sha256'),'hex') and status='pending' for update;
  if not found then raise exception using errcode='P0002',message='Invitation not found'; end if;
  if invitation.expires_at <= now() then update public.membership_invitations set status='expired' where id=invitation.id; raise exception using errcode='22023',message='Invitation expired'; end if;
  select case when email_confirmed_at is not null then lower(email) end,case when phone_confirmed_at is not null then phone end
  into authenticated_email,authenticated_phone from auth.users where id=auth.uid();
  identity_hashes := array_remove(array[case when authenticated_email is not null then encode(extensions.digest(authenticated_email,'sha256'),'hex') end,case when authenticated_phone is not null then encode(extensions.digest(authenticated_phone,'sha256'),'hex') end],null);
  if not invitation.contact_hash = any(identity_hashes) then raise exception using errcode='42501',message='Invitation contact does not match authenticated identity'; end if;
  insert into public.memberships(organization_id,branch_id,profile_id,status,joined_at) values(invitation.organization_id,invitation.branch_id,auth.uid(),'active',current_date)
  on conflict(organization_id,profile_id) do update set branch_id=excluded.branch_id,status='active',joined_at=coalesce(public.memberships.joined_at,current_date) returning * into result;
  update public.membership_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now() where id=invitation.id; return result;
end; $$;

create function public.revoke_membership_invitation(target_invitation_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare invitation public.membership_invitations; begin select * into invitation from public.membership_invitations where id=target_invitation_id for update; if not found then raise exception using errcode='P0002',message='Invitation not found'; end if; if not public.has_permission(invitation.organization_id,'members.invite',invitation.branch_id) then raise exception using errcode='42501',message='Permission denied'; end if; update public.membership_invitations set status='revoked' where id=target_invitation_id and status='pending'; end; $$;

revoke all on function public.consume_rate_limit(text,text,integer,integer) from public;
revoke all on function public.reserve_api_idempotency(uuid,text,text,text) from public;
revoke all on function public.complete_api_idempotency(text,text,integer,jsonb) from public;
revoke all on function public.create_membership_invitation(uuid,uuid,text,text,integer) from public;
revoke all on function public.accept_membership_invitation(text) from public;
revoke all on function public.revoke_membership_invitation(uuid) from public;
grant execute on function public.consume_rate_limit(text,text,integer,integer) to anon,authenticated;
grant execute on function public.reserve_api_idempotency(uuid,text,text,text) to authenticated;
grant execute on function public.complete_api_idempotency(text,text,integer,jsonb) to authenticated;
grant execute on function public.create_membership_invitation(uuid,uuid,text,text,integer) to authenticated;
grant execute on function public.accept_membership_invitation(text) to authenticated;
grant execute on function public.revoke_membership_invitation(uuid) to authenticated;
create function public.audit_invitation_metadata() returns trigger language plpgsql security definer set search_path='' as $$ declare source_row public.membership_invitations; begin source_row:=case when tg_op='DELETE' then old else new end; insert into public.audit_log(organization_id,branch_id,actor_profile_id,action,target_type,target_id,old_values,new_values) values(source_row.organization_id,source_row.branch_id,auth.uid(),lower(tg_op),'membership_invitations',source_row.id::text,case when tg_op in('UPDATE','DELETE') then jsonb_build_object('status',old.status,'expiresAt',old.expires_at) end,case when tg_op in('INSERT','UPDATE') then jsonb_build_object('status',new.status,'expiresAt',new.expires_at) end); if tg_op='DELETE' then return old; end if; return new; end; $$;
revoke all on function public.audit_invitation_metadata() from public;
create trigger audit_membership_invitations after insert or update or delete on public.membership_invitations for each row execute function public.audit_invitation_metadata();
