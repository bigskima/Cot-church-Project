-- Remove anonymous EXECUTE from privileged SECURITY DEFINER RPCs.
-- Intentional public read/visitor flows are excluded from this migration.

-- Authenticated user / leader / platform-operator RPCs.
revoke all on function public.add_stream_interaction(uuid,text,text) from public, anon;
revoke all on function public.ai_usage_totals(uuid,text,timestamptz) from public, anon;
revoke all on function public.convert_recording_to_sermon(uuid,text,text,text,uuid) from public, anon;
revoke all on function public.expression_birthdays(uuid,uuid,integer) from public, anon;
revoke all on function public.generate_expression_invite_code(uuid,uuid,integer,integer) from public, anon;
revoke all on function public.giving_summary(uuid,timestamptz,timestamptz,uuid) from public, anon;
revoke all on function public.organization_dashboard(uuid,timestamptz,timestamptz) from public, anon;
revoke all on function public.platform_delete_secret(text) from public, anon;
revoke all on function public.platform_identity_directory(text,integer,integer) from public, anon;
revoke all on function public.platform_store_secret(text,text,text,text,text) from public, anon;
revoke all on function public.publish_announcement(uuid) from public, anon;
revoke all on function public.publish_social_post(uuid,content_visibility,text,uuid,uuid,jsonb) from public, anon;
revoke all on function public.publish_social_post_with_uploads(uuid,content_visibility,text,uuid,uuid,uuid[]) from public, anon;
revoke all on function public.publish_typed_post(uuid,uuid,uuid,content_visibility,text,jsonb) from public, anon;
revoke all on function public.publish_typed_reel(uuid,uuid,content_visibility,uuid,text,text,text) from public, anon;
revoke all on function public.publish_typed_video(uuid,uuid,content_visibility,uuid,text,text,video_category,uuid,jsonb) from public, anon;
revoke all on function public.redeem_expression_invite_code(text) from public, anon;
revoke all on function public.request_donation_refund(uuid,bigint,text) from public, anon;
revoke all on function public.request_group_membership(uuid) from public, anon;
revoke all on function public.respond_governance_invitation(uuid,text) from public, anon;
revoke all on function public.review_group_membership(uuid,boolean) from public, anon;
revoke all on function public.revoke_expression_invite_code(uuid) from public, anon;
revoke all on function public.revoke_governance_invitation(uuid) from public, anon;
revoke all on function public.revoke_membership_invitation(uuid) from public, anon;
revoke all on function public.set_expression_identity_badge(uuid,uuid,text,uuid,boolean) from public, anon;
revoke all on function public.set_platform_user_restriction(uuid,text,boolean,text,timestamptz) from public, anon;
revoke all on function public.sync_content_playback(uuid,integer,integer) from public, anon;
revoke all on function public.transfer_expression_ownership_by_email(uuid,text,boolean) from public, anon;
revoke all on function public.update_membership_status(uuid,uuid,membership_status,uuid) from public, anon;

grant execute on function public.add_stream_interaction(uuid,text,text) to authenticated, service_role;
grant execute on function public.ai_usage_totals(uuid,text,timestamptz) to authenticated, service_role;
grant execute on function public.convert_recording_to_sermon(uuid,text,text,text,uuid) to authenticated, service_role;
grant execute on function public.expression_birthdays(uuid,uuid,integer) to authenticated, service_role;
grant execute on function public.generate_expression_invite_code(uuid,uuid,integer,integer) to authenticated, service_role;
grant execute on function public.giving_summary(uuid,timestamptz,timestamptz,uuid) to authenticated, service_role;
grant execute on function public.organization_dashboard(uuid,timestamptz,timestamptz) to authenticated, service_role;
grant execute on function public.platform_delete_secret(text) to authenticated, service_role;
grant execute on function public.platform_identity_directory(text,integer,integer) to authenticated, service_role;
grant execute on function public.platform_store_secret(text,text,text,text,text) to authenticated, service_role;
grant execute on function public.publish_announcement(uuid) to authenticated, service_role;
grant execute on function public.publish_social_post(uuid,content_visibility,text,uuid,uuid,jsonb) to authenticated, service_role;
grant execute on function public.publish_social_post_with_uploads(uuid,content_visibility,text,uuid,uuid,uuid[]) to authenticated, service_role;
grant execute on function public.publish_typed_post(uuid,uuid,uuid,content_visibility,text,jsonb) to authenticated, service_role;
grant execute on function public.publish_typed_reel(uuid,uuid,content_visibility,uuid,text,text,text) to authenticated, service_role;
grant execute on function public.publish_typed_video(uuid,uuid,content_visibility,uuid,text,text,video_category,uuid,jsonb) to authenticated, service_role;
grant execute on function public.redeem_expression_invite_code(text) to authenticated, service_role;
grant execute on function public.request_donation_refund(uuid,bigint,text) to authenticated, service_role;
grant execute on function public.request_group_membership(uuid) to authenticated, service_role;
grant execute on function public.respond_governance_invitation(uuid,text) to authenticated, service_role;
grant execute on function public.review_group_membership(uuid,boolean) to authenticated, service_role;
grant execute on function public.revoke_expression_invite_code(uuid) to authenticated, service_role;
grant execute on function public.revoke_governance_invitation(uuid) to authenticated, service_role;
grant execute on function public.revoke_membership_invitation(uuid) to authenticated, service_role;
grant execute on function public.set_expression_identity_badge(uuid,uuid,text,uuid,boolean) to authenticated, service_role;
grant execute on function public.set_platform_user_restriction(uuid,text,boolean,text,timestamptz) to authenticated, service_role;
grant execute on function public.sync_content_playback(uuid,integer,integer) to authenticated, service_role;
grant execute on function public.transfer_expression_ownership_by_email(uuid,text,boolean) to authenticated, service_role;
grant execute on function public.update_membership_status(uuid,uuid,membership_status,uuid) to authenticated, service_role;

-- Server / worker-only RPCs.
revoke all on function public.process_payment_result(text,text,text,uuid,text,payment_attempt_status,jsonb,text) from public, anon, authenticated;
revoke all on function public.resolve_runtime_secret(text) from public, anon, authenticated;
revoke all on function public.refresh_daily_analytics(date) from public, anon, authenticated;
revoke all on function public.route_prayer_request(uuid) from public, anon, authenticated;
revoke all on function public.reroute_prayers_for_scope(uuid,uuid) from public, anon, authenticated;
revoke all on function public.enqueue_expression_birthday_notifications(timestamptz) from public, anon, authenticated;
revoke all on function public.ensure_default_prayer_roles(uuid) from public, anon, authenticated;
revoke all on function public.ensure_role_from_blueprint(uuid,text) from public, anon, authenticated;

grant execute on function public.process_payment_result(text,text,text,uuid,text,payment_attempt_status,jsonb,text) to service_role;
grant execute on function public.resolve_runtime_secret(text) to service_role;
grant execute on function public.refresh_daily_analytics(date) to service_role;
grant execute on function public.route_prayer_request(uuid) to service_role;
grant execute on function public.reroute_prayers_for_scope(uuid,uuid) to service_role;
grant execute on function public.enqueue_expression_birthday_notifications(timestamptz) to service_role;
grant execute on function public.ensure_default_prayer_roles(uuid) to service_role;
grant execute on function public.ensure_role_from_blueprint(uuid,text) to service_role;
