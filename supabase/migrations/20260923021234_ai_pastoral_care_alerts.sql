-- COT AI pastoral safety alerts
-- Confidential, exact-scope care records created only by trusted server workflows.
-- Ordinary emotional-support conversations are NOT automatically escalated; the
-- assistant offers a member-controlled pastoral support action. Automatic alerts
-- are reserved for clear immediate safety-risk language and are disclosed to the member.

create table if not exists public.ai_pastoral_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in (
    'emotional_distress',
    'self_harm_risk',
    'harm_to_others_risk',
    'abuse_or_immediate_safety',
    'grief_or_loss',
    'other'
  )),
  severity text not null check (severity in ('support','elevated','urgent')),
  source_mode text not null check (source_mode in ('member_requested','automatic_safety')),
  status text not null default 'new' check (status in ('new','contacted','resolved','closed')),
  summary text not null check (char_length(summary) between 1 and 1500),
  conversation_excerpt text not null default '' check (char_length(conversation_excerpt) <= 6000),
  last_member_message text not null default '' check (char_length(last_member_message) <= 2000),
  requires_immediate_attention boolean not null default false,
  member_notified boolean not null default true,
  private_note text not null default '' check (char_length(private_note) <= 5000),
  assigned_to uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(branch_id,organization_id) references public.branches(id,organization_id) on delete cascade
);

create index if not exists ai_pastoral_alerts_scope_queue_idx
on public.ai_pastoral_alerts(organization_id,branch_id,status,severity,created_at desc);

create index if not exists ai_pastoral_alerts_member_idx
on public.ai_pastoral_alerts(profile_id,created_at desc);

drop trigger if exists ai_pastoral_alerts_updated on public.ai_pastoral_alerts;
create trigger ai_pastoral_alerts_updated
before update on public.ai_pastoral_alerts
for each row execute function public.set_updated_at();

alter table public.ai_pastoral_alerts enable row level security;

-- Keep the confidential alert table out of anonymous access and restrict authenticated
-- users to the two operations protected by exact-scope RLS below.
revoke all on table public.ai_pastoral_alerts from anon, authenticated;
grant select, update on table public.ai_pastoral_alerts to authenticated;

drop policy if exists ai_pastoral_alerts_pastoral_read on public.ai_pastoral_alerts;
create policy ai_pastoral_alerts_pastoral_read
on public.ai_pastoral_alerts for select to authenticated
using(public.can_receive_pastoral_followups(organization_id,branch_id));

drop policy if exists ai_pastoral_alerts_pastoral_update on public.ai_pastoral_alerts;
create policy ai_pastoral_alerts_pastoral_update
on public.ai_pastoral_alerts for update to authenticated
using(public.can_receive_pastoral_followups(organization_id,branch_id))
with check(public.can_receive_pastoral_followups(organization_id,branch_id));

-- Do not grant direct member INSERT. COT AI creates alerts through the trusted
-- server path after scope, membership, and escalation rules are resolved.

create or replace function public.ai_pastoral_recipient_count(
  target_organization_id uuid,
  target_branch_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path=''
as $$
  select count(distinct m.profile_id)::integer
  from public.memberships m
  join public.role_assignments ra
    on ra.membership_id=m.id
   and ra.organization_id=m.organization_id
  join public.role_permissions rp on rp.role_id=ra.role_id
  join public.permissions p on p.code=rp.permission_code and p.is_active=true
  where m.organization_id=target_organization_id
    and m.status='active'
    and p.code='pastoral.followups.receive'
    and (ra.expires_at is null or ra.expires_at>now())
    and (
      (target_branch_id is null and ra.branch_id is null)
      or
      (target_branch_id is not null and ra.branch_id=target_branch_id)
    );
$$;

revoke all on function public.ai_pastoral_recipient_count(uuid,uuid) from public, anon, authenticated;
grant execute on function public.ai_pastoral_recipient_count(uuid,uuid) to service_role;

create or replace function public.notify_ai_pastoral_alert()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  scope_name text := case when new.branch_id is null then 'general' else 'expression' end;
  review_route text := case when new.branch_id is null
    then '/general/leadership/pastoral-triage'
    else '/expressions/'||new.branch_id||'/manage/prayer'
  end;
begin
  insert into public.notifications(
    organization_id,
    recipient_profile_id,
    type,
    title,
    body,
    data
  )
  select distinct
    new.organization_id,
    m.profile_id,
    'ai_pastoral_alert',
    case when new.requires_immediate_attention
      then 'Urgent pastoral care alert'
      else 'Pastoral care request'
    end,
    case when new.requires_immediate_attention
      then 'A COT AI conversation needs prompt confidential pastoral review.'
      else 'A member requested confidential pastoral support through COT AI.'
    end,
    jsonb_build_object(
      'scope',scope_name,
      'branchId',new.branch_id,
      'entityType','ai_pastoral_alert',
      'entityId',new.id,
      'alertId',new.id,
      'severity',new.severity,
      'route',review_route,
      'deduplicationKey','ai-pastoral-alert:'||new.id
    )
  from public.memberships m
  join public.role_assignments ra
    on ra.membership_id=m.id
   and ra.organization_id=m.organization_id
  join public.role_permissions rp on rp.role_id=ra.role_id
  join public.permissions p on p.code=rp.permission_code and p.is_active=true
  where m.organization_id=new.organization_id
    and m.status='active'
    and p.code='pastoral.followups.receive'
    and (ra.expires_at is null or ra.expires_at>now())
    and (
      (new.branch_id is null and ra.branch_id is null)
      or
      (new.branch_id is not null and ra.branch_id=new.branch_id)
    )
  on conflict do nothing;

  return new;
end;
$$;

-- Trigger helper is internal-only; do not expose this SECURITY DEFINER function as an RPC.
revoke all on function public.notify_ai_pastoral_alert() from public, anon, authenticated;

drop trigger if exists ai_pastoral_alert_notify on public.ai_pastoral_alerts;
create trigger ai_pastoral_alert_notify
after insert on public.ai_pastoral_alerts
for each row execute function public.notify_ai_pastoral_alert();
