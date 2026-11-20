create or replace function public.resolve_content_moderation_report(
  target_report_id uuid,
  decision text,
  resolution_note text default null
)
returns public.content_moderation_reports
language plpgsql
security definer
set search_path=''
as $$
declare
  report_row public.content_moderation_reports;
  content_row public.content_items;
  result public.content_moderation_reports;
  note text := nullif(trim(coalesce(resolution_note, '')), '');
begin
  select *
  into report_row
  from public.content_moderation_reports
  where id = target_report_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Moderation report not found';
  end if;

  if auth.uid() is null
     or not public.has_permission(report_row.organization_id, 'content.moderate', report_row.expression_id)
  then
    raise exception using errcode='42501', message='Permission denied';
  end if;

  if report_row.status in ('actioned','dismissed') then
    raise exception using errcode='23514', message='Moderation report is already resolved';
  end if;

  if decision = 'review' then
    update public.content_moderation_reports
    set status='under_review',
        reviewed_by=auth.uid(),
        action_taken=null
    where id=report_row.id
    returning * into result;
    return result;
  end if;

  if decision = 'dismiss' then
    update public.content_moderation_reports
    set status='dismissed',
        reviewed_by=auth.uid(),
        action_taken=coalesce(note, 'No moderation action required')
    where id=report_row.id
    returning * into result;
    return result;
  end if;

  if decision <> 'hide_target' then
    raise exception using errcode='22023', message='Invalid moderation decision';
  end if;

  if report_row.comment_id is not null then
    update public.content_comments
    set is_hidden=true
    where id=report_row.comment_id;

    if not found then
      raise exception using errcode='P0002', message='Reported comment no longer exists';
    end if;
  else
    select *
    into content_row
    from public.content_items
    where id=report_row.content_item_id
      and organization_id=report_row.organization_id
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
      where id=content_row.id
        and organization_id=content_row.organization_id;
    elsif content_row.content_type='sermon'::public.content_item_type then
      update public.sermons
      set status='archived'
      where content_item_id=content_row.id
        and organization_id=content_row.organization_id;
    end if;
  end if;

  update public.content_moderation_reports
  set status='actioned',
      reviewed_by=auth.uid(),
      action_taken=case
        when report_row.comment_id is not null then
          'Hidden reported comment' || case when note is not null then ': ' || note else '' end
        else
          'Hidden reported content' || case when note is not null then ': ' || note else '' end
      end
  where id=report_row.id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.resolve_content_moderation_report(uuid,text,text) from public, anon;
grant execute on function public.resolve_content_moderation_report(uuid,text,text) to authenticated, service_role;
