-- Restore execute boundaries after later CREATE OR REPLACE statements reset
-- SECURITY DEFINER functions to broad/default execute privileges.

-- Server/worker-only RPCs.
revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
revoke all on function public.claim_workflow_runs(integer) from public, anon, authenticated;
revoke all on function public.claim_integration_deliveries(integer) from public, anon, authenticated;
revoke all on function public.consume_rate_limit(text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.complete_api_idempotency(text,text,integer,jsonb) from public, anon, authenticated;

grant execute on function public.claim_notification_outbox(integer) to service_role;
grant execute on function public.claim_workflow_runs(integer) to service_role;
grant execute on function public.claim_integration_deliveries(integer) to service_role;
grant execute on function public.consume_rate_limit(text,text,integer,integer) to service_role;
grant execute on function public.complete_api_idempotency(text,text,integer,jsonb) to service_role;

-- Authenticated governance/tenant RPCs. Never callable anonymously.
revoke all on function public.assign_role(uuid,uuid,uuid,uuid,timestamptz) from public, anon;
revoke all on function public.bootstrap_expression(uuid,text,text,uuid,text) from public, anon;
revoke all on function public.create_authorized_expression(uuid,text,text,text,uuid,jsonb) from public, anon;
revoke all on function public.create_custom_role(uuid,text,text,text,text[]) from public, anon;
revoke all on function public.create_expression_role_invitation(uuid,uuid,text,uuid,text,integer) from public, anon;
revoke all on function public.create_membership_invitation(uuid,uuid,text,text,integer) from public, anon;
revoke all on function public.create_organization(text,text,text,text,text) from public, anon;
revoke all on function public.create_platform_role_invitation(text,text,text,integer) from public, anon;
revoke all on function public.revoke_role_assignment(uuid,uuid) from public, anon;
revoke all on function public.set_expression_creator_authorization(uuid,text,boolean) from public, anon;
revoke all on function public.transfer_expression_ownership(uuid,uuid,boolean) from public, anon;
revoke all on function public.update_custom_role(uuid,uuid,text,text,text[]) from public, anon;

grant execute on function public.assign_role(uuid,uuid,uuid,uuid,timestamptz) to authenticated, service_role;
grant execute on function public.bootstrap_expression(uuid,text,text,uuid,text) to authenticated, service_role;
grant execute on function public.create_authorized_expression(uuid,text,text,text,uuid,jsonb) to authenticated, service_role;
grant execute on function public.create_custom_role(uuid,text,text,text,text[]) to authenticated, service_role;
grant execute on function public.create_expression_role_invitation(uuid,uuid,text,uuid,text,integer) to authenticated, service_role;
grant execute on function public.create_membership_invitation(uuid,uuid,text,text,integer) to authenticated, service_role;
grant execute on function public.create_organization(text,text,text,text,text) to authenticated, service_role;
grant execute on function public.create_platform_role_invitation(text,text,text,integer) to authenticated, service_role;
grant execute on function public.revoke_role_assignment(uuid,uuid) to authenticated, service_role;
grant execute on function public.set_expression_creator_authorization(uuid,text,boolean) to authenticated, service_role;
grant execute on function public.transfer_expression_ownership(uuid,uuid,boolean) to authenticated, service_role;
grant execute on function public.update_custom_role(uuid,uuid,text,text,text[]) to authenticated, service_role;
