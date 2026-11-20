-- Prevent signed-in callers from using SECURITY DEFINER helpers to inspect
-- another tenant's AI usage totals or another user's moderation/posting state.

revoke all on function public.ai_usage_totals(uuid,text,timestamptz) from public, anon, authenticated;
grant execute on function public.ai_usage_totals(uuid,text,timestamptz) to service_role;

create or replace function public.can_profile_post(target_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and target_profile_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Profile access denied';
  end if;

  return coalesce(
    (
      select pc.posting_allowed
        or (pc.restricted_until is not null and pc.restricted_until <= now())
      from public.profile_posting_controls pc
      where pc.profile_id = target_profile_id
    ),
    true
  );
end;
$$;

revoke all on function public.can_profile_post(uuid) from public, anon;
grant execute on function public.can_profile_post(uuid) to authenticated, service_role;

create or replace function public.is_profile_restricted(
  target_profile_id uuid,
  requested_restriction text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and target_profile_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Profile restriction access denied';
  end if;

  return exists (
    select 1
    from public.platform_user_restrictions r
    where r.profile_id = target_profile_id
      and r.restriction_code = requested_restriction
      and r.is_active
      and (r.expires_at is null or r.expires_at > now())
  );
end;
$$;

revoke all on function public.is_profile_restricted(uuid,text) from public, anon;
grant execute on function public.is_profile_restricted(uuid,text) to authenticated, service_role;
