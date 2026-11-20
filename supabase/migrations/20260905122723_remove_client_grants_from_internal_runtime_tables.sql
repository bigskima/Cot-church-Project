-- Policy-less internal runtime/control tables are server-owned.
-- Do not rely on RLS-with-no-policy as the only barrier to the Data API.

revoke all on table public.ai_models from anon, authenticated;
revoke all on table public.ai_prompt_templates from anon, authenticated;
revoke all on table public.ai_providers from anon, authenticated;
revoke all on table public.ai_routes from anon, authenticated;
revoke all on table public.ai_usage_limits from anon, authenticated;
revoke all on table public.api_rate_limits from anon, authenticated;
revoke all on table public.domain_events from anon, authenticated;
revoke all on table public.live_webhook_events from anon, authenticated;
revoke all on table public.notification_deliveries from anon, authenticated;
revoke all on table public.notification_outbox from anon, authenticated;
revoke all on table public.payment_provider_configs from anon, authenticated;
revoke all on table public.payment_provider_events from anon, authenticated;
revoke all on table public.payment_providers from anon, authenticated;
revoke all on table public.payment_routing_rules from anon, authenticated;
revoke all on table public.social_media_uploads from anon, authenticated;

grant all on table public.ai_models to service_role;
grant all on table public.ai_prompt_templates to service_role;
grant all on table public.ai_providers to service_role;
grant all on table public.ai_routes to service_role;
grant all on table public.ai_usage_limits to service_role;
grant all on table public.api_rate_limits to service_role;
grant all on table public.domain_events to service_role;
grant all on table public.live_webhook_events to service_role;
grant all on table public.notification_deliveries to service_role;
grant all on table public.notification_outbox to service_role;
grant all on table public.payment_provider_configs to service_role;
grant all on table public.payment_provider_events to service_role;
grant all on table public.payment_providers to service_role;
grant all on table public.payment_routing_rules to service_role;
grant all on table public.social_media_uploads to service_role;
