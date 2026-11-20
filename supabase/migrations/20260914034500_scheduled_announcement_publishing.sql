-- Publish due scheduled announcements and fan out the same notifications used by
-- immediate publication. This function is service-only and runs from pg_cron.

create or replace function public.publish_due_announcements(reference_time timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  published_count integer := 0;
  target public.announcements;
begin
  for target in
    select a.*
    from public.announcements a
    where a.status = 'scheduled'
      and a.scheduled_for is not null
      and a.scheduled_for <= reference_time
    order by a.scheduled_for, a.id
    for update skip locked
  loop
    update public.announcements
    set status = 'published', published_at = reference_time
    where id = target.id;

    insert into public.notifications(
      organization_id,
      recipient_profile_id,
      announcement_id,
      type,
      title,
      body,
      data
    )
    select
      target.organization_id,
      m.profile_id,
      target.id,
      'announcement',
      target.title,
      target.body,
      jsonb_build_object('announcementId', target.id)
    from public.memberships m
    where m.organization_id = target.organization_id
      and m.status = 'active'
      and (target.branch_id is null or m.branch_id = target.branch_id)
    on conflict do nothing;

    insert into public.notification_outbox(
      organization_id,
      announcement_id,
      recipient_profile_id,
      channel,
      deduplication_key,
      payload
    )
    select
      target.organization_id,
      target.id,
      m.profile_id,
      selected_channel,
      'announcement:' || target.id || ':' || m.profile_id || ':' || selected_channel::text,
      jsonb_build_object('announcementId', target.id, 'profileId', m.profile_id)
    from public.memberships m
    cross join unnest(target.channels) selected_channel
    left join public.notification_preferences p
      on p.profile_id = m.profile_id
     and p.organization_id = target.organization_id
    where m.organization_id = target.organization_id
      and m.status = 'active'
      and (target.branch_id is null or m.branch_id = target.branch_id)
      and selected_channel <> 'in_app'
      and case selected_channel
        when 'email' then coalesce(p.email_enabled, true)
        when 'sms' then coalesce(p.sms_enabled, true)
        when 'push' then coalesce(p.push_enabled, true)
        else true
      end
    on conflict(deduplication_key) do nothing;

    published_count := published_count + 1;
  end loop;

  return published_count;
end;
$function$;

revoke all on function public.publish_due_announcements(timestamptz) from public;
grant execute on function public.publish_due_announcements(timestamptz) to service_role;

create extension if not exists pg_cron;

do $block$
begin
  if exists (select 1 from cron.job where jobname = 'publish-scheduled-announcements') then
    perform cron.unschedule('publish-scheduled-announcements');
  end if;
  perform cron.schedule(
    'publish-scheduled-announcements',
    '*/5 * * * *',
    $cron$select public.publish_due_announcements(now());$cron$
  );
end;
$block$;
