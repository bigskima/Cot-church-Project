-- Expression notifications must follow the canonical Expression membership table.
-- General announcements continue to fan out to active organisation memberships.

create or replace function public.publish_announcement(target_announcement_id uuid)
returns public.announcements
language plpgsql
security definer
set search_path=''
as $$
declare
  result public.announcements;
  selected public.announcements;
begin
  select * into selected from public.announcements where id=target_announcement_id for update;
  if not found then raise exception using errcode='P0002',message='Announcement not found'; end if;
  if not public.has_permission(selected.organization_id,'announcements.manage',selected.branch_id) then
    raise exception using errcode='42501',message='Permission denied';
  end if;

  update public.announcements set status='published',published_at=now()
  where id=target_announcement_id returning * into result;

  with recipients as (
    select m.profile_id from public.memberships m
    where result.branch_id is null and m.organization_id=result.organization_id and m.status='active'
    union
    select em.profile_id from public.expression_memberships em
    where result.branch_id is not null and em.organization_id=result.organization_id and em.branch_id=result.branch_id and em.status='active'
  )
  insert into public.notifications(organization_id,recipient_profile_id,announcement_id,type,title,body,data)
  select result.organization_id,r.profile_id,result.id,'announcement',result.title,result.body,
    jsonb_build_object(
      'scope',case when result.branch_id is null then 'general' else 'expression' end,
      'branchId',result.branch_id,'entityType','announcement','entityId',result.id,'announcementId',result.id,
      'route',case when result.branch_id is null then '/general/announcements' else '/expressions/'||result.branch_id||'/announcements' end,
      'deduplicationKey','announcement:'||result.id||':published'
    )
  from recipients r on conflict do nothing;

  with recipients as (
    select m.profile_id from public.memberships m
    where result.branch_id is null and m.organization_id=result.organization_id and m.status='active'
    union
    select em.profile_id from public.expression_memberships em
    where result.branch_id is not null and em.organization_id=result.organization_id and em.branch_id=result.branch_id and em.status='active'
  )
  insert into public.notification_outbox(organization_id,announcement_id,recipient_profile_id,channel,deduplication_key,payload)
  select result.organization_id,result.id,r.profile_id,channel,
    'announcement:'||result.id||':'||r.profile_id||':'||channel::text,
    jsonb_build_object('announcementId',result.id,'profileId',r.profile_id)
  from recipients r
  cross join unnest(result.channels) channel
  left join public.notification_preferences p on p.profile_id=r.profile_id and p.organization_id=result.organization_id
  where channel<>'in_app'
    and case channel when 'email' then coalesce(p.email_enabled,true) when 'sms' then coalesce(p.sms_enabled,true) when 'push' then coalesce(p.push_enabled,true) else true end
  on conflict(deduplication_key) do nothing;

  return result;
end;
$$;

create or replace function public.publish_due_announcements(reference_time timestamptz default now())
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  published_count integer:=0;
  target public.announcements;
begin
  for target in
    select a.* from public.announcements a
    where a.status='scheduled' and a.scheduled_for is not null and a.scheduled_for<=reference_time
    order by a.scheduled_for,a.id for update skip locked
  loop
    update public.announcements set status='published',published_at=reference_time where id=target.id;

    with recipients as (
      select m.profile_id from public.memberships m
      where target.branch_id is null and m.organization_id=target.organization_id and m.status='active'
      union
      select em.profile_id from public.expression_memberships em
      where target.branch_id is not null and em.organization_id=target.organization_id and em.branch_id=target.branch_id and em.status='active'
    )
    insert into public.notifications(organization_id,recipient_profile_id,announcement_id,type,title,body,data)
    select target.organization_id,r.profile_id,target.id,'announcement',target.title,target.body,
      jsonb_build_object(
        'scope',case when target.branch_id is null then 'general' else 'expression' end,
        'branchId',target.branch_id,'entityType','announcement','entityId',target.id,'announcementId',target.id,
        'route',case when target.branch_id is null then '/general/announcements' else '/expressions/'||target.branch_id||'/announcements' end,
        'deduplicationKey','announcement:'||target.id||':published'
      )
    from recipients r on conflict do nothing;

    with recipients as (
      select m.profile_id from public.memberships m
      where target.branch_id is null and m.organization_id=target.organization_id and m.status='active'
      union
      select em.profile_id from public.expression_memberships em
      where target.branch_id is not null and em.organization_id=target.organization_id and em.branch_id=target.branch_id and em.status='active'
    )
    insert into public.notification_outbox(organization_id,announcement_id,recipient_profile_id,channel,deduplication_key,payload)
    select target.organization_id,target.id,r.profile_id,selected_channel,
      'announcement:'||target.id||':'||r.profile_id||':'||selected_channel::text,
      jsonb_build_object('announcementId',target.id,'profileId',r.profile_id)
    from recipients r
    cross join unnest(target.channels) selected_channel
    left join public.notification_preferences p on p.profile_id=r.profile_id and p.organization_id=target.organization_id
    where selected_channel<>'in_app'
      and case selected_channel when 'email' then coalesce(p.email_enabled,true) when 'sms' then coalesce(p.sms_enabled,true) when 'push' then coalesce(p.push_enabled,true) else true end
    on conflict(deduplication_key) do nothing;

    published_count:=published_count+1;
  end loop;
  return published_count;
end;
$$;

revoke all on function public.publish_due_announcements(timestamptz) from public;
grant execute on function public.publish_due_announcements(timestamptz) to service_role;
