-- Pastor's Messages is a dedicated pastoral-media classification on top of the
-- existing sermon/media infrastructure. It does not replace the sermon domain.
-- Access is controlled by dedicated permissions and exact General/Expression scope.

alter table public.sermons
  add column if not exists is_pastor_message boolean not null default false;

create index if not exists sermons_pastor_messages_scope_idx
  on public.sermons(organization_id, expression_id, status, sermon_date desc)
  where is_pastor_message = true;

insert into public.permissions(code,name,description,category,is_active)
values
  ('pastor_messages.read','View Pastor’s Messages','View published pastoral audio and video messages in an authorized scope.','media',true),
  ('pastor_messages.create','Create Pastor’s Messages','Create Pastor’s Messages drafts in an authorized scope.','media',true),
  ('pastor_messages.manage','Manage Pastor’s Messages','Edit and manage Pastor’s Messages in an authorized scope.','media',true),
  ('pastor_messages.publish','Publish Pastor’s Messages','Publish Pastor’s Messages in an authorized scope.','media',true),
  ('expression.pastor_messages.read','View Expression Pastor’s Messages','View pastoral audio and video messages inside the exact assigned Expression.','media',true),
  ('expression.pastor_messages.create','Create Expression Pastor’s Messages','Create Pastor’s Messages drafts inside the exact assigned Expression.','media',true),
  ('expression.pastor_messages.manage','Manage Expression Pastor’s Messages','Edit and manage Pastor’s Messages inside the exact assigned Expression.','media',true),
  ('expression.pastor_messages.publish','Publish Expression Pastor’s Messages','Publish Pastor’s Messages inside the exact assigned Expression.','media',true)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  is_active=true;

insert into public.role_blueprints(code,name,description,permission_codes,is_active)
values (
  'pastor_messages_manager',
  'Pastor’s Messages Manager',
  'Creates and publishes dedicated pastoral audio and video messages only in the exact assigned church or Expression scope.',
  array[
    'pastor_messages.read',
    'pastor_messages.create',
    'pastor_messages.manage',
    'pastor_messages.publish',
    'expression.pastor_messages.read',
    'expression.pastor_messages.create',
    'expression.pastor_messages.manage',
    'expression.pastor_messages.publish'
  ],
  true
)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  permission_codes=excluded.permission_codes,
  is_active=true;

create or replace function public.ensure_default_pastor_messages_role(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  blueprint public.role_blueprints;
  target_role public.roles;
  permission_code text;
begin
  if not exists(select 1 from public.organizations o where o.id=target_organization_id) then
    return;
  end if;

  select * into blueprint
  from public.role_blueprints
  where code='pastor_messages_manager'
    and is_active
  limit 1;

  if not found then return; end if;

  insert into public.roles(organization_id,code,name,description,is_system)
  values(target_organization_id,blueprint.code,blueprint.name,blueprint.description,true)
  on conflict(organization_id,code) do update
    set name=excluded.name,
        description=excluded.description,
        is_system=true
  returning * into target_role;

  foreach permission_code in array blueprint.permission_codes loop
    insert into public.role_permissions(role_id,permission_code)
    values(target_role.id,permission_code)
    on conflict do nothing;
  end loop;
end;
$function$;

revoke all on function public.ensure_default_pastor_messages_role(uuid) from public;

do $$
declare org record;
begin
  for org in select id from public.organizations loop
    perform public.ensure_default_pastor_messages_role(org.id);
  end loop;
end $$;

create or replace function public.ensure_default_pastor_messages_role_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform public.ensure_default_pastor_messages_role(new.id);
  return new;
end;
$function$;

revoke all on function public.ensure_default_pastor_messages_role_on_org_insert() from public;

drop trigger if exists organizations_default_pastor_messages_role on public.organizations;
create trigger organizations_default_pastor_messages_role
after insert on public.organizations
for each row execute function public.ensure_default_pastor_messages_role_on_org_insert();

-- Rebuild sermon RLS so normal Sermons and Pastor’s Messages are separate
-- authorization domains while sharing the same table/media infrastructure.
drop policy if exists sermons_manage_delete on public.sermons;
drop policy if exists sermons_manage_insert on public.sermons;
drop policy if exists sermons_manage_update on public.sermons;
drop policy if exists sermons_read_published on public.sermons;

create policy sermons_manage_delete
on public.sermons
for delete to authenticated
using (
  case
    when is_pastor_message then
      case when expression_id is null
        then public.has_exact_scope_permission(organization_id,'pastor_messages.manage',null)
          or public.has_exact_scope_permission(organization_id,'pastor_messages.publish',null)
        else public.has_exact_scope_permission(organization_id,'expression.pastor_messages.manage',expression_id)
          or public.has_exact_scope_permission(organization_id,'expression.pastor_messages.publish',expression_id)
      end
    when expression_id is null then
      public.has_exact_scope_permission(organization_id,'sermons.manage',null)
      or public.has_exact_scope_permission(organization_id,'sermons.publish',null)
    else
      public.has_exact_scope_permission(organization_id,'expression.sermons.manage',expression_id)
      or public.has_exact_scope_permission(organization_id,'expression.sermons.publish',expression_id)
  end
);

create policy sermons_manage_insert
on public.sermons
for insert to authenticated
with check (
  case
    when is_pastor_message then
      case when expression_id is null
        then public.has_exact_scope_permission(organization_id,'pastor_messages.create',null)
          or public.has_exact_scope_permission(organization_id,'pastor_messages.manage',null)
          or public.has_exact_scope_permission(organization_id,'pastor_messages.publish',null)
        else public.has_exact_scope_permission(organization_id,'expression.pastor_messages.create',expression_id)
          or public.has_exact_scope_permission(organization_id,'expression.pastor_messages.manage',expression_id)
          or public.has_exact_scope_permission(organization_id,'expression.pastor_messages.publish',expression_id)
      end
    when expression_id is null then
      public.has_exact_scope_permission(organization_id,'sermons.manage',null)
      or public.has_exact_scope_permission(organization_id,'sermons.publish',null)
    else
      public.has_exact_scope_permission(organization_id,'expression.sermons.manage',expression_id)
      or public.has_exact_scope_permission(organization_id,'expression.sermons.publish',expression_id)
  end
);

create policy sermons_manage_update
on public.sermons
for update to authenticated
using (
  case
    when is_pastor_message then
      case when expression_id is null
        then public.has_exact_scope_permission(organization_id,'pastor_messages.manage',null)
          or public.has_exact_scope_permission(organization_id,'pastor_messages.publish',null)
        else public.has_exact_scope_permission(organization_id,'expression.pastor_messages.manage',expression_id)
          or public.has_exact_scope_permission(organization_id,'expression.pastor_messages.publish',expression_id)
      end
    when expression_id is null then
      public.has_exact_scope_permission(organization_id,'sermons.manage',null)
      or public.has_exact_scope_permission(organization_id,'sermons.publish',null)
    else
      public.has_exact_scope_permission(organization_id,'expression.sermons.manage',expression_id)
      or public.has_exact_scope_permission(organization_id,'expression.sermons.publish',expression_id)
  end
)
with check (
  case
    when is_pastor_message then
      case when expression_id is null
        then public.has_exact_scope_permission(organization_id,'pastor_messages.manage',null)
          or public.has_exact_scope_permission(organization_id,'pastor_messages.publish',null)
        else public.has_exact_scope_permission(organization_id,'expression.pastor_messages.manage',expression_id)
          or public.has_exact_scope_permission(organization_id,'expression.pastor_messages.publish',expression_id)
      end
    when expression_id is null then
      public.has_exact_scope_permission(organization_id,'sermons.manage',null)
      or public.has_exact_scope_permission(organization_id,'sermons.publish',null)
    else
      public.has_exact_scope_permission(organization_id,'expression.sermons.manage',expression_id)
      or public.has_exact_scope_permission(organization_id,'expression.sermons.publish',expression_id)
  end
);

create policy sermons_read_published
on public.sermons
for select to authenticated
using (
  (
    status='published'
    and (
      visibility='public'
      or (visibility='organization' and public.is_organization_member(organization_id))
      or (visibility='branch' and public.is_expression_member(organization_id,expression_id))
    )
  )
  or case
    when is_pastor_message then
      case when expression_id is null
        then public.has_exact_scope_permission(organization_id,'pastor_messages.manage',null)
          or public.has_exact_scope_permission(organization_id,'pastor_messages.publish',null)
          or public.has_exact_scope_permission(organization_id,'pastor_messages.read',null)
        else public.has_exact_scope_permission(organization_id,'expression.pastor_messages.manage',expression_id)
          or public.has_exact_scope_permission(organization_id,'expression.pastor_messages.publish',expression_id)
          or public.has_exact_scope_permission(organization_id,'expression.pastor_messages.read',expression_id)
      end
    when expression_id is null then
      public.has_exact_scope_permission(organization_id,'sermons.manage',null)
      or public.has_exact_scope_permission(organization_id,'sermons.publish',null)
      or public.has_exact_scope_permission(organization_id,'sermons.read',null)
    else
      public.has_exact_scope_permission(organization_id,'expression.sermons.manage',expression_id)
      or public.has_exact_scope_permission(organization_id,'expression.sermons.publish',expression_id)
      or public.has_exact_scope_permission(organization_id,'expression.sermons.read',expression_id)
  end
);
