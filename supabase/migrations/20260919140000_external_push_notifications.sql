-- Complete the COT external-push pipeline without coupling feature actions to a provider.
-- Canonical in-app notifications fan out to the durable push outbox; a scheduled
-- notification-dispatch worker sends them through Expo Push Service.

create extension if not exists pg_net with schema extensions;

alter table public.notification_preferences
  add column if not exists timezone text not null default 'UTC',
  add column if not exists push_preview text not null default 'full',
  add column if not exists push_sound_enabled boolean not null default true;

alter table public.notification_preferences
  drop constraint if exists notification_preferences_timezone_check,
  add constraint notification_preferences_timezone_check
    check (char_length(timezone) between 1 and 80),
  drop constraint if exists notification_preferences_push_preview_check,
  add constraint notification_preferences_push_preview_check
    check (push_preview in ('full','sender_only','private'));

create or replace function public.claim_notification_outbox_channel(
  target_channel public.delivery_channel,
  batch_size integer default 50
)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.notification_outbox
  set status='dead_letter', locked_at=null
  where channel=target_channel
    and status='failed'
    and attempts>=8;

  return query
  with jobs as (
    select id
    from public.notification_outbox
    where channel=target_channel
      and status in ('pending','failed')
      and available_at<=now()
      and attempts<8
    order by available_at, id
    for update skip locked
    limit least(greatest(batch_size,1),100)
  )
  update public.notification_outbox o
  set status='processing', locked_at=now(), attempts=o.attempts+1
  from jobs
  where o.id=jobs.id
  returning o.*;
end;
$$;

revoke all on function public.claim_notification_outbox_channel(public.delivery_channel,integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_outbox_channel(public.delivery_channel,integer)
  to service_role;

create or replace function public.enqueue_notification_push()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  push_allowed boolean;
begin
  -- Announcement publishing already creates recipient-scoped push outbox jobs.
  if new.announcement_id is not null then
    return new;
  end if;

  select coalesce(p.push_enabled,true)
  into push_allowed
  from public.notification_preferences p
  where p.profile_id=new.recipient_profile_id
    and p.organization_id=new.organization_id;

  if push_allowed is null then
    push_allowed := true;
  end if;

  if push_allowed then
    insert into public.notification_outbox(
      organization_id,
      recipient_profile_id,
      channel,
      deduplication_key,
      payload
    )
    values(
      new.organization_id,
      new.recipient_profile_id,
      'push'::public.delivery_channel,
      'notification:'||new.id::text||':push',
      jsonb_build_object('notificationId',new.id)
    )
    on conflict(deduplication_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_enqueue_push on public.notifications;
create trigger notifications_enqueue_push
after insert on public.notifications
for each row execute function public.enqueue_notification_push();

create or replace function public.verify_notification_cron_secret(supplied text)
returns boolean
language sql
security definer
stable
set search_path=''
as $$
  select supplied is not null
    and exists(
      select 1
      from vault.decrypted_secrets s
      where s.name='COT_NOTIFICATION_CRON_SECRET'
        and s.decrypted_secret=supplied
    );
$$;

revoke all on function public.verify_notification_cron_secret(text)
  from public, anon, authenticated;
grant execute on function public.verify_notification_cron_secret(text)
  to service_role;

create or replace function public.configure_notification_push_cron()
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  has_url boolean;
  has_secret boolean;
  existing_job bigint;
begin
  select exists(
    select 1 from vault.decrypted_secrets
    where name='COT_EDGE_FUNCTIONS_BASE_URL'
      and nullif(btrim(decrypted_secret),'') is not null
  ) into has_url;

  select exists(
    select 1 from vault.decrypted_secrets
    where name='COT_NOTIFICATION_CRON_SECRET'
      and nullif(btrim(decrypted_secret),'') is not null
  ) into has_secret;

  if not has_url or not has_secret then
    raise exception 'COT push cron requires COT_EDGE_FUNCTIONS_BASE_URL and COT_NOTIFICATION_CRON_SECRET in Vault';
  end if;

  for existing_job in
    select jobid from cron.job where jobname='cot-notification-push-worker'
  loop
    perform cron.unschedule(existing_job);
  end loop;

  perform cron.schedule(
    'cot-notification-push-worker',
    '* * * * *',
    $cron$
      select net.http_post(
        url := (
          select rtrim(decrypted_secret,'/')
          from vault.decrypted_secrets
          where name='COT_EDGE_FUNCTIONS_BASE_URL'
          limit 1
        ) || '/notification-dispatch',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-secret',(
            select decrypted_secret
            from vault.decrypted_secrets
            where name='COT_NOTIFICATION_CRON_SECRET'
            limit 1
          )
        ),
        body := '{"action":"process_push","batchSize":20}'::jsonb,
        timeout_milliseconds := 30000
      );
    $cron$
  );
end;
$$;

revoke all on function public.configure_notification_push_cron()
  from public, anon, authenticated;
grant execute on function public.configure_notification_push_cron()
  to service_role;

do $$
begin
  if exists(select 1 from vault.secrets where name='COT_EDGE_FUNCTIONS_BASE_URL')
     and exists(select 1 from vault.secrets where name='COT_NOTIFICATION_CRON_SECRET') then
    perform public.configure_notification_push_cron();
  end if;
end;
$$;
