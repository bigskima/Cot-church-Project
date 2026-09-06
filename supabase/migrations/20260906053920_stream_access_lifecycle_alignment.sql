create or replace function public.can_access_stream(target_stream_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  s public.live_streams;
begin
  select * into s
  from public.live_streams
  where id=target_stream_id
    and status in (
      'scheduled','provisioning','ready','live','ended','processing','replay_ready','failed'
    );

  if not found then return false; end if;
  if s.visibility='public' then return true; end if;
  if auth.uid() is null then return false; end if;
  if s.visibility='organization' then return public.is_organization_member(s.organization_id); end if;
  if s.visibility='branch' then return public.is_expression_member(s.organization_id,s.branch_id); end if;
  if s.visibility='group' then return public.can_read_social_scope(s.organization_id,s.visibility,s.branch_id,s.group_id); end if;
  return public.has_permission(s.organization_id,'streams.manage',s.branch_id);
end;
$function$;

revoke all on function public.can_access_stream(uuid) from public, anon;
grant execute on function public.can_access_stream(uuid) to authenticated, service_role;
