begin;
select plan(11);

select has_function('public','register_for_event',array['uuid','uuid'],'event registration exists');
select has_function('public','cancel_event_registration',array['uuid','uuid'],'registration cancellation exists');
select ok(not has_function_privilege('anon','public.register_for_event(uuid,uuid)','execute'),'anonymous registration is denied');
select ok(not has_function_privilege('anon','public.cancel_event_registration(uuid,uuid)','execute'),'anonymous cancellation is denied');
select has_function_privilege('authenticated','public.register_for_event(uuid,uuid)','execute','authenticated registration uses guarded RPC');
select has_function_privilege('authenticated','public.cancel_event_registration(uuid,uuid)','execute','authenticated cancellation uses guarded RPC');
select policies_are('public','events',array['events_admin_insert','events_admin_read','events_admin_update','events_member_read','events_public_read'],'event policies are explicit');
select policy_roles_are('public','events','events_public_read',array['anon','authenticated'],'public events are readable in both public sessions');
select policy_roles_are('public','events','events_member_read',array['authenticated'],'member events require authentication');
select ok((select qual ilike '%is_expression_member%' from pg_policies where schemaname='public' and tablename='events' and policyname='events_member_read'),'member-event RLS requires exact Expression membership');
select ok((select count(*) from pg_trigger where tgrelid='public.event_registrations'::regclass and not tgisinternal) >= 2,'registration changes retain timestamp and audit triggers');

select * from finish();
rollback;
