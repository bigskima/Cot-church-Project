-- COT AI pastoral-care and safety escalation.
-- Ordinary emotional-support conversations are NOT silently reported.
-- A row is created only when the member explicitly requests pastoral care or
-- when the AI gateway detects explicit first-person imminent self/other-harm language.
-- Records are exact-scope pastoral data and never Platform Admin data.

create table if not exists public.ai_pastoral_alerts(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'cot_ai' check(source in ('cot_ai')),
  trigger_type text not null check(trigger_type in ('member_requested','urgent_safety')),
  risk_level text not null check(risk_level in ('routine','high')),
  category text not null check(category in ('emotional_support','self_harm','harm_to_others','other')),
  member_message text not null check(char_length(member_message) between 1 and 3000),
  conversation_summary text,
  consent_given boolean not null default false,
  status text not null default 'new' check(status in ('new','assigned','contacted','resolved','closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  private_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((trigger_type='member_requested' and consent_given=true and risk_level='routine') or (trigger_type='urgent_safety' and risk_level='high'))
);

create index if not exists ai_pastoral_alerts_scope_queue_idx
  on public.ai_pastoral_alerts(organization_id,branch_id,status,created_at desc);
create index if not exists ai_pastoral_alerts_profile_idx
  on public.ai_pastoral_alerts(profile_id,created_at desc);

drop trigger if exists ai_pastoral_alerts_updated on public.ai_pastoral_alerts;
create trigger ai_pastoral_alerts_updated
before update on public.ai_pastoral_alerts
for each row execute function public.set_updated_at();

alter table public.ai_pastoral_alerts enable row level security;

drop policy if exists ai_pastoral_alerts_pastoral_read on public.ai_pastoral_alerts;
create policy ai_pastoral_alerts_pastoral_read
on public.ai_pastoral_alerts for select to authenticated
using(public.can_receive_pastoral_followups(organization_id,branch_id));

drop policy if exists ai_pastoral_alerts_pastoral_update on public.ai_pastoral_alerts;
create policy ai_pastoral_alerts_pastoral_update
on public.ai_pastoral_alerts for update to authenticated
using(public.can_receive_pastoral_followups(organization_id,branch_id))
with check(public.can_receive_pastoral_followups(organization_id,branch_id));

drop policy if exists ai_pastoral_alerts_member_read_own on public.ai_pastoral_alerts;
create policy ai_pastoral_alerts_member_read_own
on public.ai_pastoral_alerts for select to authenticated
using(profile_id=auth.uid());

revoke all on public.ai_pastoral_alerts from anon;
revoke insert,delete on public.ai_pastoral_alerts from authenticated;
grant select on public.ai_pastoral_alerts to authenticated;
grant update(status,assigned_to,private_note) on public.ai_pastoral_alerts to authenticated;

create or replace function public.route_ai_pastoral_alert(target_alert_id uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  alert_row public.ai_pastoral_alerts;
  recipients integer:=0;
begin
  select * into alert_row from public.ai_pastoral_alerts where id=target_alert_id;
  if not found then
    raise exception using errcode='P0002',message='AI pastoral alert not found';
  end if;

  with recipient_profiles as (
    select distinct m.profile_id
    from public.memberships m
    join public.role_assignments ra on ra.membership_id=m.id and ra.organization_id=m.organization_id
    join public.role_permissions rp on rp.role_id=ra.role_id and rp.permission_code='pastoral.followups.receive'
    join public.permissions p on p.code=rp.permission_code and p.is_active
    where m.organization_id=alert_row.organization_id
      and m.status='active'
      and (ra.expires_at is null or ra.expires_at>now())
      and (
        (alert_row.branch_id is null and ra.branch_id is null)
        or (alert_row.branch_id is not null and ra.branch_id=alert_row.branch_id)
      )
  ), inserted as (
    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    select
      alert_row.organization_id,
      recipient_profiles.profile_id,
      'pastoral_ai_alert',
      case when alert_row.risk_level='high' then 'Urgent pastoral safety alert' else 'Pastoral care request' end,
      case
        when alert_row.risk_level='high' then 'A member using COT AI may need urgent pastoral attention.'
        else 'A member requested pastoral care from COT AI.'
      end,
      jsonb_build_object(
        'alertId',alert_row.id,
        'branchId',alert_row.branch_id,
        'scope',case when alert_row.branch_id is null then 'general' else 'expression' end,
        'riskLevel',alert_row.risk_level,
        'deduplicationKey','ai-pastoral:'||alert_row.id||':recipient'
      )
    from recipient_profiles
    on conflict do nothing
    returning 1
  )
  select count(*) into recipients from recipient_profiles;

  return recipients;
end;
$$;

revoke all on function public.route_ai_pastoral_alert(uuid) from public;
grant execute on function public.route_ai_pastoral_alert(uuid) to service_role;
