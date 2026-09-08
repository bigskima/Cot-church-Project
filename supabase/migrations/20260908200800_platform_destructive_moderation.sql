-- Platform destructive moderation: auditable content/comment deletion,
-- resilient Supabase Storage cleanup, and irreversible member-facing Expression deletion.

alter table public.branches
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reason text;

create index if not exists branches_deleted_by_idx
on public.branches(deleted_by)
where deleted_by is not null;

create index if not exists branches_deleted_at_idx
on public.branches(deleted_at)
where deleted_at is not null;

create table if not exists public.platform_moderation_deletions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('content','comment','expression')),
  target_id text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  expression_id uuid references public.branches(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(trim(reason)) between 3 and 1000),
  snapshot jsonb not null default '{}'::jsonb,
  storage_cleanup_status text not null default 'not_required'
    check (storage_cleanup_status in ('not_required','pending','partial','complete','failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.platform_storage_cleanup_tasks (
  id uuid primary key default gen_random_uuid(),
  deletion_id uuid not null references public.platform_moderation_deletions(id) on delete cascade,
  bucket text not null check (char_length(trim(bucket)) between 1 and 120),
  storage_path text not null check (char_length(trim(storage_path)) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending','complete','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deletion_id, bucket, storage_path)
);

drop trigger if exists platform_storage_cleanup_tasks_updated on public.platform_storage_cleanup_tasks;
create trigger platform_storage_cleanup_tasks_updated
before update on public.platform_storage_cleanup_tasks
for each row execute function public.set_updated_at();

alter table public.platform_moderation_deletions enable row level security;
alter table public.platform_storage_cleanup_tasks enable row level security;

drop policy if exists platform_moderation_deletions_no_client_access on public.platform_moderation_deletions;
create policy platform_moderation_deletions_no_client_access
on public.platform_moderation_deletions
for all to anon, authenticated
using (false)
with check (false);

drop policy if exists platform_storage_cleanup_tasks_no_client_access on public.platform_storage_cleanup_tasks;
create policy platform_storage_cleanup_tasks_no_client_access
on public.platform_storage_cleanup_tasks
for all to anon, authenticated
using (false)
with check (false);

revoke all on table public.platform_moderation_deletions from public, anon, authenticated;
revoke all on table public.platform_storage_cleanup_tasks from public, anon, authenticated;
grant select, insert, update, delete on table public.platform_moderation_deletions to service_role;
grant select, insert, update, delete on table public.platform_storage_cleanup_tasks to service_role;

create index if not exists platform_moderation_deletions_actor_idx
on public.platform_moderation_deletions(actor_profile_id)
where actor_profile_id is not null;

create index if not exists platform_moderation_deletions_expression_idx
on public.platform_moderation_deletions(expression_id)
where expression_id is not null;

create index if not exists platform_moderation_deletions_created_idx
on public.platform_moderation_deletions(created_at desc);

create index if not exists platform_storage_cleanup_tasks_deletion_status_idx
on public.platform_storage_cleanup_tasks(deletion_id,status,created_at);

create or replace function public.platform_remove_content(
  target_content_id uuid,
  actor_profile_id uuid,
  deletion_reason text,
  audit_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  content_row public.content_items;
  typed_snapshot jsonb := '{}'::jsonb;
  v_deletion_id uuid;
  asset_ids uuid[] := array[]::uuid[];
  asset_id uuid;
  storage_task_count integer := 0;
  normalized_reason text := trim(coalesce(deletion_reason,''));
begin
  if char_length(normalized_reason) < 3 or char_length(normalized_reason) > 1000 then
    raise exception using errcode='22023', message='A moderation reason between 3 and 1000 characters is required';
  end if;

  if not exists (select 1 from public.profiles p where p.id=actor_profile_id) then
    raise exception using errcode='22023', message='Moderation actor is invalid';
  end if;

  select * into content_row
  from public.content_items
  where id=target_content_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Content not found';
  end if;

  if content_row.content_type='post'::public.content_item_type then
    select coalesce(to_jsonb(sp),'{}'::jsonb)
    into typed_snapshot
    from public.social_posts sp
    where sp.id=content_row.id and sp.organization_id=content_row.organization_id;
  elsif content_row.content_type='reel'::public.content_item_type then
    select coalesce(to_jsonb(r),'{}'::jsonb)
    into typed_snapshot
    from public.reels r
    where r.id=content_row.id and r.organization_id=content_row.organization_id;
    select array_remove(array_agg(distinct r.media_asset_id),null)
    into asset_ids
    from public.reels r
    where r.id=content_row.id and r.organization_id=content_row.organization_id;
  elsif content_row.content_type='video'::public.content_item_type then
    select coalesce(to_jsonb(v),'{}'::jsonb)
    into typed_snapshot
    from public.videos v
    where v.id=content_row.id and v.organization_id=content_row.organization_id;
    select array_remove(array_agg(distinct v.media_asset_id),null)
    into asset_ids
    from public.videos v
    where v.id=content_row.id and v.organization_id=content_row.organization_id;
  elsif content_row.content_type='sermon'::public.content_item_type then
    select coalesce(to_jsonb(s),'{}'::jsonb)
    into typed_snapshot
    from public.sermons s
    where s.content_item_id=content_row.id and s.organization_id=content_row.organization_id
    order by s.created_at asc
    limit 1;
    select coalesce(array_agg(distinct asset),array[]::uuid[])
    into asset_ids
    from (
      select s.audio_asset_id as asset
      from public.sermons s
      where s.content_item_id=content_row.id and s.organization_id=content_row.organization_id
      union
      select s.video_asset_id as asset
      from public.sermons s
      where s.content_item_id=content_row.id and s.organization_id=content_row.organization_id
    ) assets
    where asset is not null;
  else
    raise exception using errcode='22023', message='This content type must be removed from its dedicated moderation workflow';
  end if;

  insert into public.platform_moderation_deletions(
    target_type,target_id,organization_id,expression_id,actor_profile_id,reason,snapshot
  )
  values(
    'content',
    content_row.id::text,
    content_row.organization_id,
    content_row.expression_id,
    actor_profile_id,
    normalized_reason,
    jsonb_build_object(
      'content',to_jsonb(content_row),
      'typed',coalesce(typed_snapshot,'{}'::jsonb)
    )
  )
  returning id into v_deletion_id;

  update public.content_moderation_reports
  set status='actioned',
      reviewed_by=actor_profile_id,
      action_taken='Removed by Platform Moderation: ' || normalized_reason
  where content_item_id=content_row.id
    and status in ('pending','under_review');

  if content_row.content_type='post'::public.content_item_type then
    insert into public.platform_storage_cleanup_tasks(deletion_id,bucket,storage_path)
    select v_deletion_id,'community-public-media',u.storage_path
    from public.social_media_uploads u
    where u.post_id=content_row.id
      and u.storage_path is not null
    on conflict do nothing;

    delete from public.social_media_uploads
    where post_id=content_row.id;
  end if;

  if content_row.content_type='sermon'::public.content_item_type then
    delete from public.sermons
    where content_item_id=content_row.id
      and organization_id=content_row.organization_id;
  end if;

  delete from public.content_items
  where id=content_row.id
    and organization_id=content_row.organization_id;

  foreach asset_id in array coalesce(asset_ids,array[]::uuid[]) loop
    if asset_id is null then continue; end if;

    if not exists(select 1 from public.reels r where r.media_asset_id=asset_id)
       and not exists(select 1 from public.videos v where v.media_asset_id=asset_id)
       and not exists(select 1 from public.sermons s where s.audio_asset_id=asset_id or s.video_asset_id=asset_id)
    then
      insert into public.platform_storage_cleanup_tasks(deletion_id,bucket,storage_path)
      select v_deletion_id,'content-media',path
      from (
        select ma.source_storage_path as path
        from public.media_assets ma
        where ma.id=asset_id
        union
        select mr.storage_path
        from public.media_renditions mr
        where mr.media_asset_id=asset_id
        union
        select mt.storage_path
        from public.media_thumbnails mt
        where mt.media_asset_id=asset_id
        union
        select mtr.storage_path
        from public.media_tracks mtr
        where mtr.media_asset_id=asset_id
      ) paths
      where path is not null and char_length(trim(path)) > 0
      on conflict do nothing;

      delete from public.media_assets
      where id=asset_id;
    end if;
  end loop;

  select count(*) into storage_task_count
  from public.platform_storage_cleanup_tasks
  where deletion_id=v_deletion_id;

  update public.platform_moderation_deletions
  set storage_cleanup_status=case when storage_task_count > 0 then 'pending' else 'not_required' end,
      completed_at=case when storage_task_count=0 then now() else null end
  where id=v_deletion_id;

  insert into public.platform_audit_log(
    actor_profile_id,action,target_type,target_id,request_id,metadata
  )
  values(
    actor_profile_id,
    'moderation.content_deleted',
    'content',
    content_row.id::text,
    audit_request_id,
    jsonb_build_object(
      'deletionId',v_deletion_id,
      'organizationId',content_row.organization_id,
      'expressionId',content_row.expression_id,
      'contentType',content_row.content_type,
      'reason',normalized_reason,
      'storageTaskCount',storage_task_count
    )
  );

  return jsonb_build_object(
    'deletionId',v_deletion_id,
    'targetType','content',
    'targetId',content_row.id,
    'contentType',content_row.content_type,
    'storageTaskCount',storage_task_count
  );
end
$function$;

create or replace function public.platform_remove_comment(
  target_comment_id uuid,
  actor_profile_id uuid,
  deletion_reason text,
  audit_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  comment_row public.content_comments;
  content_row public.content_items;
  affected_ids uuid[];
  v_deletion_id uuid;
  normalized_reason text := trim(coalesce(deletion_reason,''));
begin
  if char_length(normalized_reason) < 3 or char_length(normalized_reason) > 1000 then
    raise exception using errcode='22023', message='A moderation reason between 3 and 1000 characters is required';
  end if;

  if not exists (select 1 from public.profiles p where p.id=actor_profile_id) then
    raise exception using errcode='22023', message='Moderation actor is invalid';
  end if;

  select * into comment_row
  from public.content_comments
  where id=target_comment_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Comment not found';
  end if;

  select * into content_row
  from public.content_items
  where id=comment_row.content_item_id;

  if not found then
    raise exception using errcode='P0002', message='Parent content not found';
  end if;

  with recursive thread as (
    select c.id
    from public.content_comments c
    where c.id=target_comment_id
    union all
    select child.id
    from public.content_comments child
    join thread parent on child.parent_comment_id=parent.id
  )
  select array_agg(id) into affected_ids from thread;

  insert into public.platform_moderation_deletions(
    target_type,target_id,organization_id,expression_id,actor_profile_id,reason,snapshot,
    storage_cleanup_status,completed_at
  )
  values(
    'comment',
    comment_row.id::text,
    content_row.organization_id,
    content_row.expression_id,
    actor_profile_id,
    normalized_reason,
    jsonb_build_object(
      'comment',to_jsonb(comment_row),
      'contentId',content_row.id,
      'replyCount',greatest(coalesce(cardinality(affected_ids),1)-1,0)
    ),
    'not_required',
    now()
  )
  returning id into v_deletion_id;

  update public.content_moderation_reports
  set status='actioned',
      reviewed_by=actor_profile_id,
      action_taken='Removed by Platform Moderation: ' || normalized_reason
  where comment_id=any(coalesce(affected_ids,array[target_comment_id]))
    and status in ('pending','under_review');

  delete from public.content_comments
  where id=target_comment_id;

  insert into public.platform_audit_log(
    actor_profile_id,action,target_type,target_id,request_id,metadata
  )
  values(
    actor_profile_id,
    'moderation.comment_deleted',
    'comment',
    comment_row.id::text,
    audit_request_id,
    jsonb_build_object(
      'deletionId',v_deletion_id,
      'organizationId',content_row.organization_id,
      'expressionId',content_row.expression_id,
      'contentId',content_row.id,
      'reason',normalized_reason,
      'affectedCommentCount',coalesce(cardinality(affected_ids),1)
    )
  );

  return jsonb_build_object(
    'deletionId',v_deletion_id,
    'targetType','comment',
    'targetId',comment_row.id,
    'affectedCommentCount',coalesce(cardinality(affected_ids),1),
    'storageTaskCount',0
  );
end
$function$;

create or replace function public.platform_delete_expression(
  target_expression_id uuid,
  actor_profile_id uuid,
  deletion_reason text,
  confirmation_code text,
  audit_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  expression_row public.branches;
  v_deletion_id uuid;
  normalized_reason text := trim(coalesce(deletion_reason,''));
  normalized_confirmation text := upper(trim(coalesce(confirmation_code,'')));
  revoked_invites integer := 0;
begin
  if char_length(normalized_reason) < 3 or char_length(normalized_reason) > 1000 then
    raise exception using errcode='22023', message='A deletion reason between 3 and 1000 characters is required';
  end if;

  if not exists (select 1 from public.profiles p where p.id=actor_profile_id) then
    raise exception using errcode='22023', message='Moderation actor is invalid';
  end if;

  select * into expression_row
  from public.branches
  where id=target_expression_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Expression not found';
  end if;

  if expression_row.deleted_at is not null then
    raise exception using errcode='23514', message='Expression is already deleted';
  end if;

  if normalized_confirmation <> upper(expression_row.code) then
    raise exception using errcode='23514', message='Expression confirmation code does not match';
  end if;

  insert into public.platform_moderation_deletions(
    target_type,target_id,organization_id,expression_id,actor_profile_id,reason,snapshot,
    storage_cleanup_status,completed_at
  )
  values(
    'expression',
    expression_row.id::text,
    expression_row.organization_id,
    expression_row.id,
    actor_profile_id,
    normalized_reason,
    jsonb_build_object('expression',to_jsonb(expression_row)),
    'not_required',
    now()
  )
  returning id into v_deletion_id;

  update public.expression_invite_codes
  set status='revoked',
      revoked_by=actor_profile_id,
      revoked_at=coalesce(revoked_at,now())
  where branch_id=expression_row.id
    and organization_id=expression_row.organization_id
    and status='active';
  get diagnostics revoked_invites = row_count;

  update public.branches
  set is_active=false,
      deleted_at=now(),
      deleted_by=actor_profile_id,
      deletion_reason=normalized_reason
  where id=expression_row.id;

  insert into public.platform_audit_log(
    actor_profile_id,action,target_type,target_id,request_id,metadata
  )
  values(
    actor_profile_id,
    'expression.deleted',
    'expression',
    expression_row.id::text,
    audit_request_id,
    jsonb_build_object(
      'deletionId',v_deletion_id,
      'organizationId',expression_row.organization_id,
      'expressionName',expression_row.name,
      'expressionCode',expression_row.code,
      'reason',normalized_reason,
      'revokedInviteCodes',revoked_invites,
      'preservedHistoricalData',true
    )
  );

  return jsonb_build_object(
    'deletionId',v_deletion_id,
    'id',expression_row.id,
    'organizationId',expression_row.organization_id,
    'name',expression_row.name,
    'code',expression_row.code,
    'deleted',true,
    'revokedInviteCodes',revoked_invites
  );
end
$function$;

create or replace function public.platform_resolve_content_report(
  target_report_id uuid,
  actor_profile_id uuid,
  decision text,
  resolution_note text default null,
  audit_request_id text default null
)
returns public.content_moderation_reports
language plpgsql
security definer
set search_path = ''
as $function$
declare
  report_row public.content_moderation_reports;
  content_row public.content_items;
  result public.content_moderation_reports;
  note text := nullif(trim(coalesce(resolution_note,'')),'');
begin
  if not exists (select 1 from public.profiles p where p.id=actor_profile_id) then
    raise exception using errcode='22023', message='Moderation actor is invalid';
  end if;

  select * into report_row
  from public.content_moderation_reports
  where id=target_report_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Moderation report not found';
  end if;

  if report_row.status in ('actioned','dismissed') then
    raise exception using errcode='23514', message='Moderation report is already resolved';
  end if;

  if decision='review' then
    update public.content_moderation_reports
    set status='under_review',reviewed_by=actor_profile_id,action_taken=null
    where id=report_row.id
    returning * into result;
  elsif decision='dismiss' then
    update public.content_moderation_reports
    set status='dismissed',reviewed_by=actor_profile_id,
        action_taken=coalesce(note,'No moderation action required')
    where id=report_row.id
    returning * into result;
  elsif decision='hide_target' then
    if report_row.comment_id is not null then
      update public.content_comments
      set is_hidden=true
      where id=report_row.comment_id;
      if not found then
        raise exception using errcode='P0002', message='Reported comment no longer exists';
      end if;
    else
      select * into content_row
      from public.content_items
      where id=report_row.content_item_id and organization_id=report_row.organization_id
      for update;
      if not found then
        raise exception using errcode='P0002', message='Reported content no longer exists';
      end if;

      update public.content_items
      set status='archived'
      where id=content_row.id;

      if content_row.content_type='post'::public.content_item_type then
        update public.social_posts
        set status='hidden'
        where id=content_row.id and organization_id=content_row.organization_id;
      elsif content_row.content_type='sermon'::public.content_item_type then
        update public.sermons
        set status='archived'
        where content_item_id=content_row.id and organization_id=content_row.organization_id;
      end if;
    end if;

    update public.content_moderation_reports
    set status='actioned',reviewed_by=actor_profile_id,
        action_taken=case
          when report_row.comment_id is not null then 'Hidden reported comment'
          else 'Hidden reported content'
        end || case when note is not null then ': ' || note else '' end
    where id=report_row.id
    returning * into result;
  else
    raise exception using errcode='22023', message='Invalid moderation decision';
  end if;

  insert into public.platform_audit_log(
    actor_profile_id,action,target_type,target_id,request_id,metadata
  )
  values(
    actor_profile_id,
    'moderation.report_' || decision,
    'moderation_report',
    report_row.id::text,
    audit_request_id,
    jsonb_build_object(
      'organizationId',report_row.organization_id,
      'expressionId',report_row.expression_id,
      'contentItemId',report_row.content_item_id,
      'commentId',report_row.comment_id,
      'note',note
    )
  );

  return result;
end
$function$;

revoke all on function public.platform_remove_content(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.platform_remove_comment(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.platform_delete_expression(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.platform_resolve_content_report(uuid,uuid,text,text,text) from public, anon, authenticated;

grant execute on function public.platform_remove_content(uuid,uuid,text,text) to service_role;
grant execute on function public.platform_remove_comment(uuid,uuid,text,text) to service_role;
grant execute on function public.platform_delete_expression(uuid,uuid,text,text,text) to service_role;
grant execute on function public.platform_resolve_content_report(uuid,uuid,text,text,text) to service_role;

comment on table public.platform_moderation_deletions is 'Immutable moderation deletion evidence retained after content/comment removal or Expression tombstoning.';
comment on table public.platform_storage_cleanup_tasks is 'Server-only resilient Storage API cleanup queue created by destructive moderation operations.';
comment on column public.branches.deleted_at is 'When set, the Expression is permanently removed from member-facing use and cannot be restored through lifecycle controls.';
