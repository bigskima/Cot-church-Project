-- Restore authenticated-only execute boundaries that drifted after later function replacements.

revoke all on function public.can_access_stream(uuid) from public, anon;
revoke all on function public.begin_stream_session(uuid) from public, anon;
revoke all on function public.update_stream_presence(uuid,text) from public, anon;
revoke all on function public.reserve_api_idempotency(uuid,text,text,text) from public, anon;

grant execute on function public.can_access_stream(uuid) to authenticated, service_role;
grant execute on function public.begin_stream_session(uuid) to authenticated, service_role;
grant execute on function public.update_stream_presence(uuid,text) to authenticated, service_role;
grant execute on function public.reserve_api_idempotency(uuid,text,text,text) to authenticated, service_role;
