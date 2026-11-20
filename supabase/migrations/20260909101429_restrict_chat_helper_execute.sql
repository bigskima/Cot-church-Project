-- Keep chat RLS helper functions callable only by signed-in users and service code.
-- Supabase may grant newly-created public-schema functions to anon by default,
-- so revoke that privilege explicitly after the helper functions exist.

revoke execute on function public.can_read_direct_conversation(uuid) from public;
revoke execute on function public.can_read_direct_conversation(uuid) from anon;
grant execute on function public.can_read_direct_conversation(uuid) to authenticated, service_role;

revoke execute on function public.can_read_group_chat(uuid) from public;
revoke execute on function public.can_read_group_chat(uuid) from anon;
grant execute on function public.can_read_group_chat(uuid) to authenticated, service_role;
