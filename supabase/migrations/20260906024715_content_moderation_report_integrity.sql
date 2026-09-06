drop policy if exists moderation_reports_manage on public.content_moderation_reports;

create policy moderation_reports_reporter_insert
on public.content_moderation_reports
for insert to authenticated
with check(
  reporter_profile_id = auth.uid()
  and status = 'pending'
  and reviewed_by is null
  and action_taken is null
);

create policy moderation_reports_reporter_read
on public.content_moderation_reports
for select to authenticated
using(reporter_profile_id = auth.uid());

create policy moderation_reports_moderator_read
on public.content_moderation_reports
for select to authenticated
using(public.has_permission(organization_id,'content.moderate',expression_id));

create policy moderation_reports_moderator_update
on public.content_moderation_reports
for update to authenticated
using(public.has_permission(organization_id,'content.moderate',expression_id))
with check(public.has_permission(organization_id,'content.moderate',expression_id));

create or replace function public.protect_content_moderation_report_evidence()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.organization_id is distinct from old.organization_id
     or new.expression_id is distinct from old.expression_id
     or new.content_item_id is distinct from old.content_item_id
     or new.comment_id is distinct from old.comment_id
     or new.reporter_profile_id is distinct from old.reporter_profile_id
     or new.reason is distinct from old.reason
     or new.details is distinct from old.details
     or new.created_at is distinct from old.created_at
  then
    raise exception using errcode='23514', message='Moderation report evidence is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists content_moderation_reports_protect_evidence on public.content_moderation_reports;
create trigger content_moderation_reports_protect_evidence
before update on public.content_moderation_reports
for each row execute function public.protect_content_moderation_report_evidence();
