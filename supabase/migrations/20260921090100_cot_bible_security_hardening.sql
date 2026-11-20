-- Bible security hardening: Daily Scripture is resolved through the Bible edge
-- handler, so clients do not need direct SECURITY DEFINER RPC execution.
revoke all on function public.resolve_daily_scripture(uuid,date) from public,anon,authenticated;
grant execute on function public.resolve_daily_scripture(uuid,date) to service_role;
