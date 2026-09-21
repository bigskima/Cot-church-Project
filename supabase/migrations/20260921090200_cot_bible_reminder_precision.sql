-- Honour each member's chosen Daily Scripture reminder time to five-minute
-- precision and make the notification idempotent for that local calendar day.
create or replace function public.enqueue_due_daily_scripture_notifications()
returns integer
language plpgsql security definer set search_path='' as $$
declare inserted_count integer := 0;
begin
  with due as (
    select distinct on (p.profile_id,p.organization_id)
      p.profile_id,
      p.organization_id,
      p.timezone,
      p.notification_time,
      (now() at time zone p.timezone)::date as local_date,
      (now() at time zone p.timezone)::time as local_time
    from public.bible_user_preferences p
    where p.daily_scripture_notification
      and (now() at time zone p.timezone)::time >= p.notification_time
      and (now() at time zone p.timezone)::time < (p.notification_time + interval '5 minutes')::time
  ), resolved as (
    select d.*,s.reference,s.version_id,s.theme
    from due d
    cross join lateral public.resolve_daily_scripture(d.organization_id,d.local_date) s
  ), prepared as (
    select
      r.*,
      'daily-scripture:'||r.local_date::text as dedup_key
    from resolved r
  )
  insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
  select
    r.organization_id,
    r.profile_id,
    'daily_scripture',
    'Today''s Scripture',
    r.reference,
    jsonb_build_object(
      'scope','general',
      'entityType','bible',
      'reference',r.reference,
      'versionId',r.version_id,
      'theme',r.theme,
      'route','/general/bible?reference='||replace(r.reference,' ','%20'),
      'dedupKey',r.dedup_key
    )
  from prepared r
  where not exists (
    select 1
    from public.notifications n
    where n.recipient_profile_id=r.profile_id
      and n.organization_id=r.organization_id
      and n.type='daily_scripture'
      and n.data->>'dedupKey'=r.dedup_key
  );

  get diagnostics inserted_count=row_count;
  return inserted_count;
end $$;

revoke all on function public.enqueue_due_daily_scripture_notifications() from public,anon,authenticated;
grant execute on function public.enqueue_due_daily_scripture_notifications() to service_role;

do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    begin perform cron.unschedule('cot-bible-daily-scripture'); exception when others then null; end;
    perform cron.schedule(
      'cot-bible-daily-scripture',
      '*/5 * * * *',
      'select public.enqueue_due_daily_scripture_notifications();'
    );
  end if;
end $$;
