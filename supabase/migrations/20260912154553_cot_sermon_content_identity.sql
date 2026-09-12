-- Sermons share the same canonical identity used by engagement and media access.
-- Existing visibility is copied exactly; Expression sermons stay private.
create schema if not exists private;

create or replace function private.sync_sermon_content_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' and old.content_item_id is not null and new.content_item_id is distinct from old.content_item_id then
    raise exception using errcode='23514',message='Sermon content identity cannot be changed';
  end if;
  new.content_item_id := coalesce(new.content_item_id,new.id);
  if exists (select 1 from public.content_items c where c.id=new.content_item_id
    and (c.organization_id<>new.organization_id or c.content_type<>'sermon')) then
    raise exception using errcode='23514',message='Invalid sermon content identity';
  end if;
  insert into public.content_items (id,organization_id,expression_id,author_profile_id,content_type,visibility,status,published_at,created_at)
  values (new.content_item_id,new.organization_id,new.expression_id,new.created_by,'sermon',new.visibility,new.status::public.publication_status,new.published_at,new.created_at)
  on conflict (id) do update set expression_id=excluded.expression_id,author_profile_id=excluded.author_profile_id,
    visibility=excluded.visibility,status=excluded.status,published_at=excluded.published_at;
  return new;
end;
$$;
revoke all on function private.sync_sermon_content_identity() from public,anon,authenticated;
create trigger sermons_sync_content_identity before insert or update of content_item_id,expression_id,visibility,status,published_at,created_by on public.sermons
for each row execute function private.sync_sermon_content_identity();

-- Touch only the identity column; the trigger copies the current scope/status.
update public.sermons set content_item_id=coalesce(content_item_id,id);
alter table public.sermons alter column content_item_id set not null;
create unique index if not exists sermons_content_item_id_key on public.sermons(content_item_id);
alter table public.sermons add constraint sermons_content_identity_fkey
foreign key (content_item_id,organization_id) references public.content_items(id,organization_id) on delete cascade;

create or replace function private.remove_sermon_content_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.content_items where id=old.content_item_id and organization_id=old.organization_id and content_type='sermon';
  return old;
end;
$$;
revoke all on function private.remove_sermon_content_identity() from public,anon,authenticated;
create trigger sermons_remove_content_identity after delete on public.sermons
for each row when (pg_trigger_depth()=0) execute function private.remove_sermon_content_identity();
