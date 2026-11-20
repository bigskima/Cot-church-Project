-- Regression exercise. All fixtures and mutations are rolled back.
-- Run with psql -v ON_ERROR_STOP=1 -f scripts/verify-cot-content.sql.
begin;
set local plpgsql.check_asserts = on;
create temporary table cot_fixture (owner_id uuid,member_id uuid,outsider_id uuid,org_id uuid,branch_a uuid,branch_b uuid,open_group uuid,approval_group uuid,private_group uuid,sermon_id uuid);
grant select on cot_fixture to authenticated,anon;
do $$
declare
  owner_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); outsider_id uuid:=gen_random_uuid();
  org_id uuid:=gen_random_uuid(); branch_a uuid:=gen_random_uuid(); branch_b uuid:=gen_random_uuid();
  owner_membership uuid; member_membership uuid; group_open uuid; group_approval uuid; group_private uuid; sermon_id uuid;
  joined public.group_memberships; request_row public.group_memberships;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (owner_id,owner_id||'@cot-test.invalid','{"display_name":"COT regression owner"}'),
    (member_id,member_id||'@cot-test.invalid','{"display_name":"COT regression member"}'),
    (outsider_id,outsider_id||'@cot-test.invalid','{"display_name":"COT regression outsider"}');
  insert into public.organizations(id,name,slug,created_by) values(org_id,'COT regression','regression-'||org_id,owner_id);
  insert into public.branches(id,organization_id,name,code) values(branch_a,org_id,'Primary','PRIMARY'),(branch_b,org_id,'Secondary','SECONDARY');
  insert into public.memberships(organization_id,branch_id,profile_id,status) values(org_id,branch_b,owner_id,'active') returning id into owner_membership;
  insert into public.memberships(organization_id,branch_id,profile_id,status) values(org_id,branch_a,member_id,'active') returning id into member_membership;
  insert into public.expression_memberships(organization_id,branch_id,membership_id,profile_id,status,joined_at)
    values(org_id,branch_b,owner_membership,owner_id,'active',now()),(org_id,branch_b,member_membership,member_id,'active',now())
    on conflict(branch_id,profile_id) do nothing;
  insert into public.groups(organization_id,branch_id,name,created_by,join_policy,capacity)
    values(org_id,branch_b,'Open group',owner_id,'open',2) returning id into group_open;
  insert into public.groups(organization_id,branch_id,name,created_by,join_policy)
    values(org_id,branch_b,'Approval group',owner_id,'approval') returning id into group_approval;
  insert into public.groups(organization_id,branch_id,name,created_by,visibility,join_policy)
    values(org_id,branch_b,'Private group',owner_id,'private','invite') returning id into group_private;
  assert (select count(*)=3 from public.group_memberships where membership_id=owner_membership and status='active' and is_leader), 'creator must be an active leader in every created group';
  perform set_config('request.jwt.claim.sub',member_id::text,true);
  joined:=public.request_group_membership(group_open);
  assert joined.id is not null and joined.status='active', 'open joining from a secondary Expression must succeed';
  assert (public.request_group_membership(group_open)).id=joined.id, 'repeated join must be idempotent';
  request_row:=public.request_group_membership(group_approval);
  assert request_row.id is not null and request_row.status='requested', 'first approval request must exist';
  begin perform public.request_group_membership(group_private); raise exception 'private group admitted an uninvited member'; exception when insufficient_privilege then null; end;
  begin perform public.review_group_membership(request_row.id,true); raise exception 'member reviewed their own request'; exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  assert (public.review_group_membership(request_row.id,true)).status='active', 'creator must be able to review a request without a separate role';
  assert public.can_read_group_chat(group_private), 'creator must access private group chat';
  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  begin perform public.request_group_membership(group_open); raise exception 'outsider joined an Expression group'; exception when insufficient_privilege then null; end;
  assert not public.can_read_group_chat(group_private), 'outsider must not read private group chat';
  perform set_config('request.jwt.claim.sub','',true);
  insert into public.sermons(organization_id,expression_id,title,slug,preacher,created_by,status,visibility)
    values(org_id,branch_b,'Regression sermon','regression-sermon','Test',owner_id,'published','branch') returning id into sermon_id;
  assert exists(select 1 from public.content_items c where c.id=sermon_id and c.visibility='branch' and c.status='published' and c.expression_id=branch_b), 'sermon must create a scoped content identity';
  update public.sermons set status='archived' where id=sermon_id;
  assert (select status='archived' from public.content_items where id=sermon_id), 'sermon publication must synchronize';
  update public.sermons set status='published' where id=sermon_id;
  insert into cot_fixture values(owner_id,member_id,outsider_id,org_id,branch_a,branch_b,group_open,group_approval,group_private,sermon_id);
end;
$$;
select set_config('request.jwt.claim.sub',(select member_id::text from cot_fixture),true);
set local role authenticated;
do $$ begin
  assert (select count(*)=1 from public.sermons where id=(select sermon_id from cot_fixture)), 'member must read Expression sermon through RLS';
  assert (select count(*)=1 from public.content_items where id=(select sermon_id from cot_fixture)), 'member must read its canonical content through RLS';
  assert (select count(*)=0 from public.groups where id=(select private_group from cot_fixture)), 'nonmember must not discover private group';
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
  assert (select count(*)=0 from public.sermons where id=(select sermon_id from cot_fixture)), 'anonymous visitors must not see Expression sermon';
  assert (select count(*)=0 from public.content_items where id=(select sermon_id from cot_fixture)), 'anonymous visitors must not see Expression content';
end $$;
reset role;
do $$ begin
  delete from public.sermons where id=(select sermon_id from cot_fixture);
  assert (select count(*)=0 from public.content_items where id=(select sermon_id from cot_fixture)), 'deleted sermon must not leave orphan public content';
end $$;
select 'COT content and membership regression checks passed' as result;
rollback;
