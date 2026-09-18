create or replace function public.claim_general_live_source_refresh(
  target_organization_id uuid,
  target_provider_config_id uuid,
  target_channel_id text,
  claim_seconds integer default 20
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  affected_rows integer := 0;
  safe_claim_seconds integer;
begin
  if target_organization_id is null
     or target_provider_config_id is null
     or nullif(btrim(target_channel_id), '') is null then
    return false;
  end if;

  safe_claim_seconds := greatest(5, least(coalesce(claim_seconds, 20), 60));

  insert into public.general_live_source_cache (
    organization_id,
    provider_config_id,
    provider_code,
    channel_id,
    stream_payload,
    expires_at,
    refresh_claimed_until
  )
  values (
    target_organization_id,
    target_provider_config_id,
    'youtube',
    btrim(target_channel_id),
    '{}'::jsonb,
    now(),
    null
  )
  on conflict (organization_id) do nothing;

  update public.general_live_source_cache
  set
    provider_config_id = target_provider_config_id,
    provider_code = 'youtube',
    channel_id = btrim(target_channel_id),
    refresh_claimed_until = now() + make_interval(secs => safe_claim_seconds),
    updated_at = now()
  where organization_id = target_organization_id
    and (
      provider_config_id is distinct from target_provider_config_id
      or channel_id is distinct from btrim(target_channel_id)
      or expires_at is null
      or expires_at <= now()
    )
    and (refresh_claimed_until is null or refresh_claimed_until <= now());

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$function$;

revoke all on function public.claim_general_live_source_refresh(uuid,uuid,text,integer) from public;
revoke all on function public.claim_general_live_source_refresh(uuid,uuid,text,integer) from anon;
revoke all on function public.claim_general_live_source_refresh(uuid,uuid,text,integer) from authenticated;
grant execute on function public.claim_general_live_source_refresh(uuid,uuid,text,integer) to service_role;
