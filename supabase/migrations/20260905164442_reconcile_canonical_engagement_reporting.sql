-- Reconcile organization reporting with the canonical universal engagement layer.
-- Community reactions now live in content_reactions; report them within the requested period.

create or replace function public.organization_dashboard(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.has_permission(target_organization_id, 'reports.read') then
    raise exception using errcode='42501', message='Permission denied';
  end if;

  if period_end <= period_start or period_end - period_start > interval '2 years' then
    raise exception using errcode='22023', message='Invalid period';
  end if;

  return jsonb_build_object(
    'members', (
      select count(*)
      from public.memberships
      where organization_id = target_organization_id
        and status = 'active'
    ),
    'events', (
      select count(*)
      from public.events
      where organization_id = target_organization_id
        and starts_at >= period_start
        and starts_at < period_end
    ),
    'attendance', (
      select count(*)
      from public.attendance_records
      where organization_id = target_organization_id
        and checked_in_at >= period_start
        and checked_in_at < period_end
    ),
    'giving', (
      select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
      from (
        select currency, sum(amount_minor) total
        from public.donations
        where organization_id = target_organization_id
          and status = 'succeeded'
          and succeeded_at >= period_start
          and succeeded_at < period_end
        group by currency
      ) giving_totals
    ),
    'engagement', jsonb_build_object(
      'posts', (
        select count(*)
        from public.social_posts
        where organization_id = target_organization_id
          and published_at >= period_start
          and published_at < period_end
      ),
      'reactions', (
        select count(*)
        from public.content_reactions cr
        join public.content_items ci on ci.id = cr.content_item_id
        where ci.organization_id = target_organization_id
          and ci.content_type = 'post'::public.content_item_type
          and cr.created_at >= period_start
          and cr.created_at < period_end
      )
    )
  );
end
$function$;

revoke all on function public.organization_dashboard(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.organization_dashboard(uuid,timestamptz,timestamptz) to authenticated, service_role;
