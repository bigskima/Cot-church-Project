begin;
select plan(19);

select has_table('public','expression_memberships','Expression memberships exist');
select has_table('public','expression_invite_codes','Expression invite codes exist');
select ok((select relrowsecurity from pg_class where oid='public.expression_memberships'::regclass),'Expression membership RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.expression_invite_codes'::regclass),'Expression invite-code RLS enabled');
select col_is_pk('public','expression_memberships','id','Expression membership has a primary key');
select col_is_pk('public','expression_invite_codes','id','Expression invite code has a primary key');
select has_function('public','is_expression_member',array['uuid','uuid'],'exact Expression membership resolver exists');
select has_function('public','preview_expression_invite_code',array['text'],'invite preview exists');
select has_function('public','redeem_expression_invite_code',array['text'],'invite redemption exists');
select has_function('public','generate_expression_invite_code',array['uuid','uuid','integer','integer'],'invite generation exists');
select has_function('public','revoke_expression_invite_code',array['uuid'],'invite revocation exists');
select ok(not has_function_privilege('anon','public.preview_expression_invite_code(text)','execute'),'anonymous users cannot preview invite codes');
select ok(not has_function_privilege('anon','public.redeem_expression_invite_code(text)','execute'),'anonymous users cannot redeem invite codes');
select ok(not has_function_privilege('anon','public.generate_expression_invite_code(uuid,uuid,integer,integer)','execute'),'anonymous users cannot generate invite codes');
select ok(not has_function_privilege('anon','public.revoke_expression_invite_code(uuid)','execute'),'anonymous users cannot revoke invite codes');
select has_function_privilege('authenticated','public.preview_expression_invite_code(text)','execute','authenticated users can validate an invite through the guarded function');
select has_function_privilege('authenticated','public.redeem_expression_invite_code(text)','execute','authenticated users can redeem an invite through the guarded function');
select ok((select count(*) from pg_policies where schemaname='public' and tablename='expression_memberships') >= 2,'Expression memberships have self-read and managed policies');
select ok((select count(*) from pg_policies where schemaname='public' and tablename='expression_invite_codes') >= 1,'Invite metadata has a scoped management policy');

select * from finish();
rollback;
