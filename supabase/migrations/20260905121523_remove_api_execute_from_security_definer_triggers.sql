-- Trigger functions execute through attached database triggers, not through PostgREST RPC.
-- Remove direct API-role EXECUTE from every SECURITY DEFINER trigger function in public.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and p.prorettype = 'trigger'::regtype
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      fn.signature
    );
  end loop;
end;
$$;
