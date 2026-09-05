-- Align donation and Expression invite RPC grants with their current Edge contracts.

revoke all on function public.create_donation_intent(uuid,uuid,uuid,bigint,text,text,text,boolean,text) from public, anon;
grant execute on function public.create_donation_intent(uuid,uuid,uuid,bigint,text,text,text,boolean,text) to authenticated, service_role;

revoke all on function public.create_online_donation_intent(uuid,uuid,uuid,uuid,uuid,bigint,text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.create_online_donation_intent(uuid,uuid,uuid,uuid,uuid,bigint,text,text,text,boolean,text) to service_role;

revoke all on function public.preview_expression_invite_code(text) from public, anon;
grant execute on function public.preview_expression_invite_code(text) to authenticated, service_role;
