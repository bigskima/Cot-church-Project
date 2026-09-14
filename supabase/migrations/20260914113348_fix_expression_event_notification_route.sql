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
        'route','/expressions/'||new.branch_id||'/event/'||new.id,'deduplicationKey','event:'||new.id||':published'
      )
    from public.expression_memberships em
    where em.organization_id=new.organization_id and em.branch_id=new.branch_id and em.status='active'
    on conflict do nothing;
  end if;
  return new;
end;
$$;
