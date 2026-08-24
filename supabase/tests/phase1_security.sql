begin;
select plan(17);

select has_table('public','profiles','profiles table exists');
select has_table('public','organizations','organizations table exists');
select has_table('public','memberships','memberships table exists');
select has_table('public','role_assignments','role assignments table exists');
select has_table('public','audit_log','audit log table exists');
select has_table('public','membership_invitations','membership invitations table exists');
select has_table('public','api_rate_limits','rate limit table exists');
select has_table('public','api_idempotency_keys','idempotency table exists');
select ok((select relrowsecurity from pg_class where oid='public.profiles'::regclass),'profiles RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.memberships'::regclass),'memberships RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.membership_invitations'::regclass),'invitation RLS enabled');
select has_function('public','has_permission',array['uuid','text','uuid'],'permission resolver exists');
select has_function('public','create_membership_invitation',array['uuid','uuid','text','text','integer'],'invitation creator exists');
select has_function('public','accept_membership_invitation',array['text'],'invitation acceptance exists');
select has_function('public','reserve_api_idempotency',array['uuid','text','text','text'],'idempotency reservation exists');
select has_function('public','complete_api_idempotency',array['text','text','integer','jsonb'],'idempotency completion exists');
select ok(not has_function_privilege('anon','public.accept_membership_invitation(text)','execute'),'anonymous users cannot accept invitations');

select * from finish();
rollback;
