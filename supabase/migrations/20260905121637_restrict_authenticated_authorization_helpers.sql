-- Remove anonymous EXECUTE from authorization helpers used only by
-- authenticated RLS policies and authenticated Edge Function flows.
-- Public-content helpers remain excluded.

revoke all on function public.can_moderate_prayer_intake(uuid,uuid) from public, anon;
revoke all on function public.can_moderate_prayer_scope(uuid,uuid,prayer_visibility) from public, anon;
revoke all on function public.can_profile_post(uuid) from public, anon;
revoke all on function public.can_read_branch_scoped_resource(uuid,uuid) from public, anon;
revoke all on function public.can_read_giving_scope(uuid,uuid) from public, anon;
revoke all on function public.can_read_member_profile(uuid) from public, anon;
revoke all on function public.can_receive_pastoral_followups(uuid,uuid) from public, anon;
revoke all on function public.can_receive_prayer_intake(uuid,uuid) from public, anon;
revoke all on function public.can_receive_prayer_scope(uuid,uuid,prayer_visibility) from public, anon;
revoke all on function public.has_exact_scope_permission(uuid,text,uuid) from public, anon;
revoke all on function public.has_expression_creator_authorization(uuid) from public, anon;
revoke all on function public.has_platform_permission(text) from public, anon;
revoke all on function public.is_profile_restricted(uuid,text) from public, anon;

grant execute on function public.can_moderate_prayer_intake(uuid,uuid) to authenticated, service_role;
grant execute on function public.can_moderate_prayer_scope(uuid,uuid,prayer_visibility) to authenticated, service_role;
grant execute on function public.can_profile_post(uuid) to authenticated, service_role;
grant execute on function public.can_read_branch_scoped_resource(uuid,uuid) to authenticated, service_role;
grant execute on function public.can_read_giving_scope(uuid,uuid) to authenticated, service_role;
grant execute on function public.can_read_member_profile(uuid) to authenticated, service_role;
grant execute on function public.can_receive_pastoral_followups(uuid,uuid) to authenticated, service_role;
grant execute on function public.can_receive_prayer_intake(uuid,uuid) to authenticated, service_role;
grant execute on function public.can_receive_prayer_scope(uuid,uuid,prayer_visibility) to authenticated, service_role;
grant execute on function public.has_exact_scope_permission(uuid,text,uuid) to authenticated, service_role;
grant execute on function public.has_expression_creator_authorization(uuid) to authenticated, service_role;
grant execute on function public.has_platform_permission(text) to authenticated, service_role;
grant execute on function public.is_profile_restricted(uuid,text) to authenticated, service_role;
