-- Public Reels use the anon/public Data API path. The content_items RLS policy
-- calls has_permission(), which delegates to has_exact_scope_permission().
-- After the authorization hardening migration, anon lost EXECUTE on that
-- SECURITY DEFINER helper, causing public Reels queries to fail with 42501.
-- The helper is safe to expose to anon because it only returns a boolean and
-- auth.uid() is NULL for anon requests, so it cannot grant a real permission.

revoke execute on function public.has_exact_scope_permission(uuid,text,uuid) from public;
grant execute on function public.has_exact_scope_permission(uuid,text,uuid)
  to anon, authenticated, service_role;