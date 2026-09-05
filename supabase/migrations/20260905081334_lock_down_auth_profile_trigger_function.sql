-- Trigger functions are invoked by PostgreSQL internally and must not be exposed
-- as callable SECURITY DEFINER RPCs to client roles.

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.handle_new_user() from service_role;
