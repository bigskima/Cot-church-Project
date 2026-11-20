-- Keep General and Expression notification delivery scope explicit and routeable.

create or replace function public.notify_published_announcement_scoped()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status <> 'published' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'published' then return new; end if;

  if new.branch_id is null then
    insert into public.notifications(organization_id,recipient_profile_id,announcement_id,type,title,body,data)
    select new.organization_id,m.profile_id,new.id,'announcement',new.title,new.body,
      jsonb_build_object(
        'scope','general','branchId',null,'entityType','announcement','entityId',new.id,
        'announcementId',new.id,'route','/general/announcements',
        'deduplicationKey','announcement:'||new.id||':published'
      )
    from public.memberships m
    where m.organization_id=new.organization_id and m.status='active'
    on conflict do nothing;
  else
    insert into public.notifications(organization_id,recipient_profile_id,announcement_id,type,title,body,data)
    select new.organization_id,em.profile_id,new.id,'announcement',new.title,new.body,
      jsonb_build_object(
        'scope','expression','branchId',new.branch_id,'entityType','announcement','entityId',new.id,
        'announcementId',new.id,'route','/expressions/'||new.branch_id||'/announcements',
        'deduplicationKey','announcement:'||new.id||':published'
      )
    from public.expression_memberships em
    where em.organization_id=new.organization_id and em.branch_id=new.branch_id and em.status='active'
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists announcements_notify_after_publish on public.announcements;
create trigger announcements_notify_after_publish
after insert or update of status on public.announcements
for each row execute function public.notify_published_announcement_scoped();

create or replace function public.notify_published_event_scoped()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status <> 'published' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'published' then return new; end if;

  if new.branch_id is null then
    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    select new.organization_id,m.profile_id,'event_published',new.title,
      case when new.description is null or btrim(new.description)='' then 'A new church event has been published.' else left(new.description,600) end,
      jsonb_build_object(
        'scope','general','branchId',null,'entityType','event','entityId',new.id,'eventId',new.id,
        'route','/general/event/'||new.id,'deduplicationKey','event:'||new.id||':published'
      )
    from public.memberships m
    where m.organization_id=new.organization_id and m.status='active'
    on conflict do nothing;
  else
    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    select new.organization_id,em.profile_id,'event_published',new.title,
      case when new.description is null or btrim(new.description)='' then 'A new Expression event has been published.' else left(new.description,600) end,
      jsonb_build_object(
        'scope','expression','branchId',new.branch_id,'entityType','event','entityId',new.id,'eventId',new.id,
        'route','/expressions/'||new.branch_id||'/events/'||new.id,'deduplicationKey','event:'||new.id||':published'
      )
    from public.expression_memberships em
    where em.organization_id=new.organization_id and em.branch_id=new.branch_id and em.status='active'
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists events_notify_after_publish on public.events;
create trigger events_notify_after_publish
after insert or update of status on public.events
for each row execute function public.notify_published_event_scoped();

create or replace function public.notify_testimony_workflow_scoped()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  scope_name text := case when new.branch_id is null then 'general' else 'expression' end;
  review_route text := case when new.branch_id is null
    then '/general/leadership/pastoral-triage'
    else '/expressions/'||new.branch_id||'/manage/testimonies'
  end;
begin
  if new.status='submitted' and (tg_op='INSERT' or old.status is distinct from 'submitted') then
    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    select distinct new.organization_id,m.profile_id,'testimony_review_requested','Testimony waiting for review',new.title,
      jsonb_build_object(
        'scope',scope_name,'branchId',new.branch_id,'entityType','testimony','entityId',new.id,
        'testimonyId',new.id,'route',review_route,
        'deduplicationKey','testimony:'||new.id||':review-requested'
      )
    from public.memberships m
    join public.role_assignments ra on ra.membership_id=m.id and ra.organization_id=m.organization_id
    join public.role_permissions rp on rp.role_id=ra.role_id
    where m.organization_id=new.organization_id
      and m.status='active'
      and (ra.expires_at is null or ra.expires_at>now())
      and rp.permission_code in ('testimonies.review','testimonies.manage')
      and ((new.branch_id is null and ra.branch_id is null) or (new.branch_id is not null and ra.branch_id=new.branch_id))
    on conflict do nothing;
  end if;

  if tg_op='UPDATE'
     and old.status is distinct from new.status
     and new.status in ('reviewing','responded','approved','declined','archived') then
    insert into public.notifications(organization_id,recipient_profile_id,type,title,body,data)
    values(
      new.organization_id,new.author_profile_id,'testimony_status_changed',
      case new.status
        when 'reviewing' then 'Your testimony is being reviewed'
        when 'responded' then 'A leader responded to your testimony'
        when 'approved' then 'Your testimony was approved'
        when 'declined' then 'Your testimony review is complete'
        else 'Your testimony was archived'
      end,
      new.title,
      jsonb_build_object(
        'scope',scope_name,'branchId',new.branch_id,'entityType','testimony','entityId',new.id,
        'testimonyId',new.id,'status',new.status,
        'route',case when new.branch_id is null then '/general/participate' else '/expressions/'||new.branch_id||'/testimonies' end,
        'deduplicationKey','testimony:'||new.id||':status:'||new.status
      )
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists testimonies_notify_workflow on public.testimonies;
create trigger testimonies_notify_workflow
after insert or update of status on public.testimonies
for each row execute function public.notify_testimony_workflow_scoped();
