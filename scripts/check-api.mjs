import { access, readFile, readdir } from 'node:fs/promises';

const requiredFiles = [
  'supabase/config.toml',
  'supabase/functions/_shared/config.ts',
  'supabase/functions/_shared/context.ts',
  'supabase/functions/_shared/cors.ts',
  'supabase/functions/_shared/errors.ts',
  'supabase/functions/_shared/handler.ts',
  'supabase/functions/_shared/logging.ts',
  'supabase/functions/_shared/request.ts',
  'supabase/functions/_shared/response.ts',
  'supabase/functions/_shared/supabase.ts',
  'supabase/functions/_shared/validation.ts',
  'supabase/functions/login/index.ts',
  'supabase/functions/refresh-session/index.ts',
  'supabase/functions/signup/index.ts',
  'supabase/functions/password-recovery/index.ts',
  'supabase/functions/password-reset/index.ts',
  'supabase/functions/profile/index.ts',
  'supabase/functions/verify-otp/index.ts',
  'supabase/functions/organization-context/index.ts',
  'supabase/functions/onboarding/index.ts',
  'supabase/functions/organizations/index.ts',
  'supabase/functions/branches/index.ts',
  'supabase/functions/memberships/index.ts',
  'supabase/functions/roles/index.ts',
  'supabase/functions/role-assignments/index.ts',
  'supabase/functions/permissions/index.ts',
  'supabase/functions/events/index.ts',
  'supabase/functions/event-registrations/index.ts',
  'supabase/functions/attendance/index.ts',
  'supabase/functions/audit-log/index.ts',
  'supabase/functions/organization-units/index.ts',
  'supabase/functions/groups/index.ts',
  'supabase/functions/prayer-requests/index.ts',
  'supabase/functions/volunteers/index.ts',
  'supabase/functions/announcements/index.ts',
  'supabase/functions/notification-settings/index.ts',
  'supabase/functions/conversations/index.ts',
  'supabase/functions/notifications/index.ts',
  'supabase/functions/notification-dispatch/index.ts',
  'supabase/functions/governance-invitations/index.ts',
  'supabase/functions/membership-invitations/index.ts',
  'supabase/functions/expression-memberships/index.ts',
  'supabase/functions/_shared/rate-limit.ts',
  'supabase/functions/giving/index.ts',
  'supabase/functions/public-giving/index.ts',
  'supabase/functions/finance/index.ts',
  'supabase/functions/payment-events/index.ts',
  'supabase/functions/live-streams/index.ts',
  'supabase/functions/social-feed/index.ts',
  'supabase/functions/community-media/index.ts',
  'supabase/functions/_shared/public-identity.ts',
  'supabase/functions/public-content/index.ts',
  'supabase/functions/engagement/index.ts',
  'supabase/functions/_shared/feed-ranking.ts',
  'supabase/functions/reports/index.ts',
  'supabase/functions/integrations/index.ts',
  'supabase/functions/workflow-dispatch/index.ts',
  'supabase/functions/streaming-broadcasts/index.ts',
  'supabase/functions/streaming-webhook/index.ts',
  'supabase/functions/streaming-recordings/index.ts',
  'supabase/functions/stream-access/index.ts',
  'supabase/functions/ai-gateway/index.ts',
  'supabase/functions/ai-review/index.ts',
  'supabase/functions/sermons/index.ts',
  'supabase/functions/branding/index.ts',
  'supabase/functions/church-story/index.ts',
  'supabase/functions/platform-context/index.ts',
  'supabase/functions/platform-overview/index.ts',
  'supabase/functions/platform-organizations/index.ts',
  'supabase/functions/platform-expressions/index.ts',
  'supabase/functions/platform-users/index.ts',
  'supabase/functions/platform-roles-access/index.ts',
  'supabase/functions/platform-audit/index.ts',
  'supabase/functions/platform-streaming/index.ts',
  'supabase/functions/platform-ai/index.ts',
  'supabase/functions/platform-admin-guide/index.ts',
  'supabase/functions/platform-features/index.ts',
  'supabase/functions/platform-integrations/index.ts',
  'supabase/functions/platform-payments/index.ts',
  'supabase/functions/platform-giving/index.ts',
  'supabase/functions/search/index.ts',
];

await Promise.all(requiredFiles.map((file) => access(file)));

const handler = await readFile('supabase/functions/_shared/handler.ts', 'utf8');
const authContext = await readFile('supabase/functions/_shared/context.ts', 'utf8');
const response = await readFile('supabase/functions/_shared/response.ts', 'utf8');
const signup = await readFile('supabase/functions/signup/index.ts', 'utf8');
const organizationContext = await readFile('supabase/functions/organization-context/index.ts', 'utf8');
const platformRolesAccess = await readFile('supabase/functions/platform-roles-access/index.ts', 'utf8');
const streamingBroadcasts = await readFile('supabase/functions/streaming-broadcasts/index.ts', 'utf8');
const liveStreams = await readFile('supabase/functions/live-streams/index.ts', 'utf8');
const onboarding = await readFile('supabase/functions/onboarding/index.ts', 'utf8');
const mobileOnboarding = await readFile('apps/mobile/app/onboarding.tsx', 'utf8');
const onboardingGate = await readFile('apps/mobile/src/components/OnboardingGate.tsx', 'utf8');
const login = await readFile('supabase/functions/login/index.ts', 'utf8');
const refreshSession = await readFile('supabase/functions/refresh-session/index.ts', 'utf8');
const passwordReset = await readFile('supabase/functions/password-reset/index.ts', 'utf8');
const organizations = await readFile('supabase/functions/organizations/index.ts', 'utf8');
const memberships = await readFile('supabase/functions/memberships/index.ts', 'utf8');
const expressionMemberships = await readFile('supabase/functions/expression-memberships/index.ts', 'utf8');
const roles = await readFile('supabase/functions/roles/index.ts', 'utf8');
const events = await readFile('supabase/functions/events/index.ts', 'utf8');
const signupRateLimited = await readFile('supabase/functions/signup/index.ts', 'utf8');
const rateLimit = await readFile('supabase/functions/_shared/rate-limit.ts', 'utf8');
const paymentEvents = await readFile('supabase/functions/payment-events/index.ts', 'utf8');
const publicContent = await readFile('supabase/functions/public-content/index.ts', 'utf8');
const socialFeed = await readFile('supabase/functions/social-feed/index.ts', 'utf8');
const communityMedia = await readFile('supabase/functions/community-media/index.ts', 'utf8');
const publicIdentity = await readFile('supabase/functions/_shared/public-identity.ts', 'utf8');
const engagement = await readFile('supabase/functions/engagement/index.ts', 'utf8');
const homeFeed = await readFile('supabase/functions/home-feed/index.ts', 'utf8');
const feedRanking = await readFile('supabase/functions/_shared/feed-ranking.ts', 'utf8');
const eventRegistrations = await readFile('supabase/functions/event-registrations/index.ts', 'utf8');
const sermons = await readFile('supabase/functions/sermons/index.ts', 'utf8');
const branding = await readFile('supabase/functions/branding/index.ts', 'utf8');
const churchStory = await readFile('supabase/functions/church-story/index.ts', 'utf8');
const prayerRequests = await readFile('supabase/functions/prayer-requests/index.ts', 'utf8');
const giving = await readFile('supabase/functions/giving/index.ts', 'utf8');
const publicGiving = await readFile('supabase/functions/public-giving/index.ts', 'utf8');
const platformGiving = await readFile('supabase/functions/platform-giving/index.ts', 'utf8');
const retiredSearch = await readFile('supabase/functions/search/index.ts', 'utf8');
const platformPayments = await readFile('supabase/functions/platform-payments/index.ts', 'utf8');
const platformStreaming = await readFile('supabase/functions/platform-streaming/index.ts', 'utf8');
const platformAi = await readFile('supabase/functions/platform-ai/index.ts', 'utf8');
const platformAdminGuide = await readFile('supabase/functions/platform-admin-guide/index.ts', 'utf8');
const aiRouter = await readFile('supabase/functions/_shared/ai/router.ts', 'utf8');
const adminGuidePage = await readFile('apps/admin/src/components/AdminGuide.tsx', 'utf8');
const adminShell = await readFile('apps/admin/src/components/Shell.tsx', 'utf8');
const platformSecrets = await readFile('supabase/functions/platform-secrets/index.ts', 'utf8');
const platformFeatures = await readFile('supabase/functions/platform-features/index.ts', 'utf8');
const platformIntegrations = await readFile('supabase/functions/platform-integrations/index.ts', 'utf8');
const notifications = await readFile('supabase/functions/notifications/index.ts', 'utf8');
const notificationSettings = await readFile('supabase/functions/notification-settings/index.ts', 'utf8');
const mobileNotificationSettingsPage = await readFile('apps/mobile/app/(tabs)/profile/notification-settings.tsx', 'utf8');
const mobileSavedLibrary = await readFile('apps/mobile/app/(tabs)/profile/saved.tsx', 'utf8');
const governanceInvitations = await readFile('supabase/functions/governance-invitations/index.ts', 'utf8');
const mobileNotificationsPage = await readFile('apps/mobile/app/(tabs)/profile/notifications.tsx', 'utf8');
const adminAiPage = await readFile('apps/admin/src/pages/AiInfrastructure.tsx', 'utf8');
const adminStreamingPage = await readFile('apps/admin/src/pages/StreamingInfrastructure.tsx', 'utf8');
const adminPaymentsPage = await readFile('apps/admin/src/pages/PaymentInfrastructure.tsx', 'utf8');
const adminIntegrationsPage = await readFile('apps/admin/src/pages/IntegrationsJobs.tsx', 'utf8');
const adminFeaturesPage = await readFile('apps/admin/src/pages/FeatureFlags.tsx', 'utf8');
const gatewayConfig = await readFile('supabase/config.toml', 'utf8');
const rateLimitRpcHardening = await readFile('supabase/migrations/20260905103057_restore_privileged_rpc_execute_boundaries.sql', 'utf8');
const privilegedRpcGrantHardening = await readFile('supabase/migrations/20260905121228_harden_remaining_privileged_rpc_execute_grants.sql', 'utf8');
const streamGrantHardening = await readFile('supabase/migrations/20260905121401_restore_stream_and_idempotency_execute_boundaries.sql', 'utf8');
const triggerGrantHardening = await readFile('supabase/migrations/20260905121523_remove_api_execute_from_security_definer_triggers.sql', 'utf8');
const profileStateRpcHardening = await readFile('supabase/migrations/20260905122057_harden_ai_usage_and_profile_state_rpc_access.sql', 'utf8');

const invariants = [
  [handler, /request\.method === "OPTIONS"/, 'CORS preflight handling'],
  [handler, /authenticate\(request/, 'central authentication'],
  [handler, /options\.organization \?\? "optional"/, 'handler preserves explicit organisation context mode'],
  [authContext, /organizationMode === "none"[\s\S]*?organizationId[\s\S]*?null/, 'organisation-independent endpoints ignore stale organisation headers'],
  [authContext, /organizationMode === "none"[\s\S]*?branchId[\s\S]*?null/, 'organisation-independent endpoints ignore stale Expression headers'],
  [handler, /authorize\(auth/, 'central authorization'],
  [handler, /api_request_failed/, 'structured failure logging'],
  [response, /requestId/, 'request IDs in response envelopes'],
  [response, /Cache-Control.*no-store/, 'no-store response caching'],
  [gatewayConfig, /\[functions\.onboarding\][\s\S]*?verify_jwt\s*=\s*false/, 'onboarding gateway delegates authentication to shared handler'],
  [signup, /client\.auth\.signUp/, 'Supabase Auth signup'],
  [signup, /assertNoUnknownFields/, 'strict signup validation'],
  [organizationContext, /effectivePermissions/, 'effective permission resolution'],
  [organizationContext, /publicCapabilitiesResult[\s\S]*publicCapabilities/, 'public capability resolution independent of Expression roles'],
  [platformRolesAccess, /methods:\s*\["GET",\s*"PATCH"\]/, 'Roles & Access read/update methods'],
  [platformRolesAccess, /platform\.roles\.read/, 'Roles & Access read authority'],
  [platformRolesAccess, /platform\.roles\.manage/, 'Roles & Access mutation authority'],
  [platformRolesAccess, /set_public_capability_assignment/, 'audited public capability assignment'],
  [streamingBroadcasts, /organization:\s*"none"/, 'broadcast authority does not depend on stale membership headers'],
  [streamingBroadcasts, /has_public_capability/, 'root public broadcast capability check'],
  [streamingBroadcasts, /has_permission[\s\S]*streams\.broadcast/, 'Expression broadcast permission check'],
  [streamingBroadcasts, /EXPRESSION_PUBLICATION_REQUIRES_SEPARATE_FLOW/, 'Expression livestreams cannot leak directly to General Community'],
  [liveStreams, /PUBLIC_LIVE_PERMISSION_REQUIRED/, 'public broadcast management role boundary'],
  [onboarding, /methods:\s*\["GET",\s*"POST"\]/, 'onboarding read/update backend methods'],
  [onboarding, /authentication:\s*"required"/, 'onboarding requires an authenticated identity'],
  [onboarding, /action === "accept_policy"/, 'versioned onboarding policy acknowledgement'],
  [onboarding, /action === "complete"/, 'versioned onboarding completion'],
  [mobileOnboarding, /api\.request<OnboardingPayload>\('onboarding'/, 'mobile onboarding API contract'],
  [onboardingGate, /api[\s\S]*\.request<OnboardingStatus>\('onboarding'/, 'authenticated first-run onboarding gate'],
  [organizationContext, /expressionMemberships/, 'multiple Expression membership resolution'],
  [organizationContext, /requestedExpressionMembership/, 'deliberate exact Expression context resolution'],
  [expressionMemberships, /expression-invite-preview/, 'Expression invite preview rate limiting'],
  [expressionMemberships, /expression-invite-redeem/, 'Expression invite redemption rate limiting'],
  [expressionMemberships, /generate_expression_invite_code/, 'server-generated Expression invite codes'],
  [expressionMemberships, /revoke_expression_invite_code/, 'Expression invite revocation'],
  [publicContent, /type === "expression"/, 'public Expression profile contract'],
  [socialFeed, /organization:\s*"optional"/, 'social publishing separates public and scoped membership context'],
  [socialFeed, /body\.organizationId[\s\S]*targetOrganizationId/, 'root General Community publishing accepts explicit church context'],
  [communityMedia, /organization:\s*"none"/, 'community media ignores stale membership headers'],
  [communityMedia, /expression_memberships/, 'Expression media still validates exact membership'],
  [publicIdentity, /profileAuthorMap/, 'public profile-authored posts resolve identity without membership'],
  [publicContent, /type === "event"/, 'exact public event detail contract'],
  [publicContent, /type === "video"/, 'exact public video detail contract'],
  [publicContent, /type === "sermon"/, 'exact public sermon detail contract'],
  [publicContent, /Search must be between 2 and 100 characters/, 'bounded public search input'],
  [publicContent, /type === "series-detail"/, 'exact public sermon series contract'],
  [publicContent, /PUBLIC_SERIES_SERMONS_FAILED/, 'series partial-failure handling'],
  [publicContent, /replace\(\/\[\\\\%_\]/, 'public search wildcard escaping'],
  [eventRegistrations, /cancel_event_registration/, 'event registration cancellation'],
  [eventRegistrations, /REGISTRATION_ACCESS_DENIED/, 'event eligibility error mapping'],
  [homeFeed, /rankFeedCandidates/, 'public feed personalization pipeline'],
  [homeFeed, /followedExpressionIds/, 'follow-driven public recommendations'],
  [homeFeed, /inProgressContentIds/, 'continue-watching recommendation signal'],
  [homeFeed, /value === selectedExpressionId/, 'exact Expression home isolation'],
  [feedRanking, /completedPenalty/, 'completed-content recommendation suppression'],
  [feedRanking, /diversifyFeed/, 'mixed-format feed diversification'],
  [engagement, /view.*state/, 'engagement viewer-state retrieval'],
  [engagement, /body\.action === "unreact"/, 'reaction removal contract'],
  [publicContent, /content_items\.visibility.*public/s, 'public media visibility boundary'],
  [churchStory, /EXPRESSION_MEMBERSHIP_REQUIRED/, 'internal Expression leadership boundary'],
  [login, /signInWithPassword/, 'password login workflow'],
  [refreshSession, /auth\.refreshSession/, 'refresh-token session rotation'],
  [refreshSession, /enforceRateLimit/, 'refresh session rate limiting'],
  [passwordReset, /auth\.getUser\(token\)/, 'password reset recovery-token validation'],
  [passwordReset, /auth\.updateUser\(\{ password \}\)/, 'Supabase recovery-session password reset completion'],
  [organizations, /create_organization/, 'transactional organization provisioning'],
  [organizations, /Main Expression/, 'canonical initial Expression provisioning'],
  [memberships, /update_membership_status/, 'protected membership lifecycle'],
  [roles, /create_custom_role/, 'custom role administration'],
  [events, /events\.create/, 'event authorization'],
  [signupRateLimited, /enforceRateLimit/, 'signup rate limiting'],
  [rateLimit, /import \{ adminClient \} from "\.\/supabase\.ts";/, 'rate limiter uses server-privileged Supabase client'],
  [rateLimit, /adminClient\(\)\.rpc\("consume_rate_limit"/, 'rate limiter invokes privileged RPC through service role'],
  [rateLimitRpcHardening, /revoke all on function public\.consume_rate_limit\(text,text,integer,integer\) from public, anon, authenticated/i, 'rate-limit RPC denied to client roles'],
  [rateLimitRpcHardening, /grant execute on function public\.consume_rate_limit\(text,text,integer,integer\) to service_role/i, 'rate-limit RPC granted only to service role'],
  [paymentEvents, /HMAC/, 'payment event signature validation'],
  [publicContent, /visibility.*public/, 'public content visibility enforcement'],
  [sermons, /sermons\.create/, 'sermon authorization'],
  [branding, /platform\.branding\.manage/, 'branding authorization'],
  [churchStory, /leadership_profiles/, 'leadership profile management'],
  [prayerRequests, /action === "pray"/, 'prayer-wall support action'],
  [prayerRequests, /prayer_supports/, 'server-backed prayer support persistence'],
  [prayerRequests, /viewer_has_prayed/, 'per-viewer prayer support state'],
  [prayerRequests, /ignoreDuplicates:\s*true/, 'idempotent prayer support'],
  [prayerRequests, /prayer_count/, 'server-backed prayer support count'],
  [giving, /requireExpression\(auth\.branchId\)/, 'expression giving management requires expression context'],
  [giving, /online_payment_enabled:\s*false/, 'expression online giving remains unavailable'],
  [publicGiving, /ORGANIZATION_REQUIRED/, 'public giving requires explicit church scope'],
  [publicGiving, /expressionId/, 'public giving supports explicit expression scope'],
  [publicGiving, /manualBankTransfer/, 'manual transfer is exposed as a server-driven giving method'],
  [platformGiving, /PLATFORM_GIVING_RETIRED/, 'retired Platform Giving endpoint boundary'],
  [platformGiving, /does not own church giving/i, 'church-owned giving retirement message'],
  [retiredSearch, /SEARCH_ENDPOINT_RETIRED/, 'retired duplicate search endpoint'],
  [retiredSearch, /public-content/, 'canonical public discovery search destination'],
  [platformPayments, /authorizePlatform\(auth, "platform\.payments\.read"\)/, 'Level-1 payment read authorization'],
  [platformPayments, /authorizePlatform\(auth, "platform\.payments\.manage"\)/, 'Level-1 payment manage authorization'],
  [platformPayments, /payment_provider_configs/, 'database-driven payment provider configuration'],
  [platformPayments, /platform_audit_log/, 'payment governance audit trail'],
  [platformPayments, /Deno\.env\.get\(config\.secret_reference\)/, 'runtime secret-reference validation before provider activation'],
  [platformStreaming, /platform\.streaming\./, 'Level-1 streaming authority'],
  [platformAi, /platform\.ai\./, 'Level-1 AI authority'],
  [platformSecrets, /SECRET_STORE_FAILED", "Unable to store provider credential\. Please try again\."/ , 'secret storage hides raw database failures'],
  [platformFeatures, /platform\.features\./, 'Level-1 feature authority'],
  [platformIntegrations, /platform\.integrations\./, 'Level-1 integrations authority'],
  [mobileNotificationsPage, /api\.request\('notifications',\s*\{[\s\S]*?method:\s*'PATCH'[\s\S]*?JSON\.stringify\(\{\s*id:\s*item\.id,\s*read:\s*true\s*\}\)/, 'Mobile notification read client payload'],
  [notifications, /methods:\s*\[\s*"GET"\s*,\s*"PATCH"\s*\]/, 'Notification read/update backend methods'],
  [notifications, /assertNoUnknownFields\(body,\s*\[\s*"id"\s*,\s*"read"\s*\]\)/, 'Notification update backend payload fields'],
  [notificationSettings, /methods:\s*\["GET",\s*"PUT",\s*"POST",\s*"DELETE"\]/, 'Notification preference and device methods'],
  [notificationSettings, /body\.emailEnabled \?\? existing\.email_enabled/, 'Notification preference partial-update preservation'],
  [notificationSettings, /body\.smsEnabled \?\? existing\.sms_enabled/, 'SMS preference partial-update preservation'],
  [notificationSettings, /body\.pushEnabled \?\? existing\.push_enabled/, 'Push preference partial-update preservation'],
  [mobileNotificationSettingsPage, /api\.request<NotificationPreferences>\('notification-settings'/, 'Mobile notification settings read contract'],
  [mobileNotificationSettingsPage, /method:\s*'PUT'/, 'Mobile notification settings update method'],
  [mobileNotificationSettingsPage, /emailEnabled[\s\S]*smsEnabled[\s\S]*pushEnabled[\s\S]*quietHours/, 'Mobile notification preference payload'],
  [engagement, /view"\) === "saved"/, 'authenticated Saved Library backend view'],
  [engagement, /content_bookmarks/, 'Saved Library canonical bookmark source'],
  [engagement, /social_posts[\s\S]*reels[\s\S]*videos[\s\S]*sermons/, 'Saved Library typed content hydration'],
  [mobileSavedLibrary, /engagement\?view=saved/, 'mobile Saved Library API contract'],
  [mobileSavedLibrary, /action:\s*'bookmark'/, 'Saved Library remove action'],
  [mobileNotificationsPage, /api\.request\('governance-invitations',\s*\{[\s\S]*?method:\s*'POST'[\s\S]*?JSON\.stringify\(\{\s*invitationId:\s*invitation\.id,\s*decision\s*\}\)/, 'Mobile governance invitation response client payload'],
  [governanceInvitations, /methods:\s*\[\s*"GET"\s*,\s*"POST"\s*\]/, 'Governance invitation backend methods'],
  [governanceInvitations, /assertNoUnknownFields\(body,\s*\[\s*"invitationId"\s*,\s*"decision"\s*\]\)/, 'Governance invitation backend payload fields'],
  [governanceInvitations, /new Set\(\[\s*"accept"\s*,\s*"decline"\s*\]\)/, 'Governance invitation decision values'],
  [adminAiPage, /action:\s*'configure_provider'/, 'Admin AI configure-provider client action'],
  [platformAi, /action === "configure_provider"/, 'Admin AI configure-provider backend action'],
  [platformAi, /credential_configured/, 'Admin AI provider credential readiness state'],
  [platformAi, /AI_PROVIDER_CREDENTIAL_MISSING/, 'AI provider activation requires a resolvable credential'],
  [platformAi, /ai_providers!inner\(status\)/, 'AI route model validation includes provider state'],
  [platformAi, /belong to an active provider/, 'AI routes reject disabled-provider models'],
  [aiRouter, /'admin\.help': 'generateText'/, 'Admin Guide capability uses provider-neutral AI routing'],
  [aiRouter, /organizationId: string \| null/, 'AI router supports platform-wide global routes'],
  [platformAdminGuide, /authorizePlatform\(auth,\s*"platform\.overview\.read"\)/, 'Admin Guide requires Platform Administration authority'],
  [platformAdminGuide, /capabilityCode:\s*"admin\.help"/, 'Admin Guide executes the dedicated admin-help capability'],
  [platformAdminGuide, /organizationId:\s*null/, 'Admin Guide uses a global platform AI route'],
  [adminGuidePage, /platform-admin-guide/, 'Admin Guide UI is connected to its backend endpoint'],
  [adminShell, /<AdminGuide/, 'Admin Guide is available throughout the shared admin shell'],
  [platformAi, /resolve_runtime_secret/, 'AI provider credential validation uses runtime secret resolver'],
  [adminAiPage, /action:\s*'upsert_model'/, 'Admin AI model client action'],
  [platformAi, /action === "upsert_model"/, 'Admin AI model backend action'],
  [adminAiPage, /action:\s*'set_route'/, 'Admin AI route client action'],
  [adminAiPage, /1 · CREDENTIAL/, 'Admin AI guided provider setup credential step'],
  [adminAiPage, /2 · MODEL/, 'Admin AI guided provider setup model step'],
  [adminAiPage, /3 · ROUTE/, 'Admin AI guided provider setup route step'],
  [platformAi, /action === "set_route"/, 'Admin AI route backend action'],
  [adminStreamingPage, /action:\s*'configure_global'/, 'Admin streaming configuration client action'],
  [platformStreaming, /action === "configure_global"/, 'Admin streaming configuration backend action'],
  [adminStreamingPage, /action:\s*'set_provider_active'/, 'Admin streaming provider-state client action'],
  [platformStreaming, /action === "set_provider_active"/, 'Admin streaming provider-state backend action'],
  [adminStreamingPage, /action:\s*'terminate_stream'/, 'Admin streaming termination client action'],
  [platformStreaming, /action === "terminate_stream"/, 'Admin streaming termination backend action'],
  [adminPaymentsPage, /action:\s*'upsert_provider_config'/, 'Admin payment configuration client action'],
  [platformPayments, /action === "upsert_provider_config"/, 'Admin payment configuration backend action'],
  [adminIntegrationsPage, /action:\s*'retry_job'/, 'Admin integration retry client action'],
  [platformIntegrations, /action === "retry_job"/, 'Admin integration retry backend action'],
  [adminIntegrationsPage, /action:\s*'set_connection_status'/, 'Admin integration state client action'],
  [platformIntegrations, /action === "set_connection_status"/, 'Admin integration state backend action'],
  [adminFeaturesPage, /action:\s*'set_global'/, 'Admin feature-control client action'],
  [platformFeatures, /action === "set_global"/, 'Admin feature-control backend action'],
  [privilegedRpcGrantHardening, /platform_store_secret\(text,text,text,text,text\).*from public, anon/s, 'secret-store anonymous execute revocation'],
  [platformAi, /Add this provider API key before activating it/, 'AI activation returns admin-safe credential guidance'],
  [privilegedRpcGrantHardening, /resolve_runtime_secret\(text\).*from public, anon, authenticated/s, 'runtime-secret service-only execute boundary'],
  [privilegedRpcGrantHardening, /process_payment_result\(text,text,text,uuid,text,payment_attempt_status,jsonb,text\).*from public, anon, authenticated/s, 'payment-result service-only execute boundary'],
  [privilegedRpcGrantHardening, /generate_expression_invite_code\(uuid,uuid,integer,integer\).*from public, anon/s, 'Expression invite anonymous execute revocation'],
  [privilegedRpcGrantHardening, /update_membership_status\(uuid,uuid,membership_status,uuid\).*from public, anon/s, 'membership mutation anonymous execute revocation'],
  [streamGrantHardening, /can_access_stream\(uuid\).*from public, anon/s, 'stream-access anonymous execute revocation'],
  [streamGrantHardening, /reserve_api_idempotency\(uuid,text,text,text\).*from public, anon/s, 'idempotency anonymous execute revocation'],
  [triggerGrantHardening, /p\.prorettype = 'trigger'::regtype/, 'security-definer trigger execute hardening'],
  [profileStateRpcHardening, /ai_usage_totals\(uuid,text,timestamptz\).*from public, anon, authenticated/s, 'AI usage totals service-only boundary'],
  [profileStateRpcHardening, /target_profile_id <> auth\.uid\(\)/, 'profile-state self-only direct RPC boundary'],
];

const missing = invariants.filter(([source, pattern]) => !pattern.test(source));
const forbidden = [
  [organizations, /Main Campus/, 'stale Campus default in organization provisioning'],
  [platformGiving, /platform\.giving\.(?:read|manage)|authorizePlatform/, 'retired Platform Giving authorization path'],
  [churchStory, /Foundation & First Gathering|Multi-Expression Expansion|Global Digital Ministry/, 'fabricated church story fallback'],
  [signup, /password\(body\.password\)/, 'hardcoded signup password policy'],
  [signup, /length\s*<\s*\d+.*password|password.*length\s*<\s*\d+/s, 'hardcoded signup password length rule'],
];
const presentForbidden = forbidden.filter(([source, pattern]) => pattern.test(source));

async function collectSourceFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...await collectSourceFiles(path));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) paths.push(path);
  }
  return paths;
}

const clientSourceFiles = [
  ...await collectSourceFiles('apps/mobile'),
  ...await collectSourceFiles('apps/admin'),
];
const endpointReferences = new Map();
const literalRequest = /\b(?:api|platformApi)\.request(?:<[^;]{0,500}?>)?\(\s*([\`'"])([^\`'"]+)\1/gms;
for (const file of clientSourceFiles) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(literalRequest)) {
    const rawPath = match[2];
    const slug = rawPath.split(/[?/$]/, 1)[0];
    if (!slug || slug.includes('${')) continue;
    const paths = endpointReferences.get(slug) ?? [];
    paths.push(file);
    endpointReferences.set(slug, paths);
  }
}
const missingEndpointFunctions = [];
for (const [slug, paths] of endpointReferences) {
  try {
    await access(`supabase/functions/${slug}/index.ts`);
  } catch {
    missingEndpointFunctions.push(`${slug} <- ${[...new Set(paths)].join(', ')}`);
  }
}

const functionEntries = await readdir('supabase/functions', { withFileTypes: true });
const publicHandlerFunctions = [];
for (const entry of functionEntries) {
  if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
  const path = `supabase/functions/${entry.name}/index.ts`;
  try {
    const source = await readFile(path, 'utf8');
    if (/authentication\s*:\s*["']none["']/.test(source)) publicHandlerFunctions.push(entry.name);
  } catch {
    // Directories without an index.ts are not Edge Function entrypoints.
  }
}

const gatewayMismatches = publicHandlerFunctions.filter((functionName) => {
  const header = `[functions.${functionName}]`;
  const sectionStart = gatewayConfig.indexOf(header);
  if (sectionStart < 0) return true;
  const remainder = gatewayConfig.slice(sectionStart + header.length);
  const nextSection = remainder.search(/\n\s*\[/);
  const section = nextSection >= 0 ? remainder.slice(0, nextSection) : remainder;
  return !/verify_jwt\s*=\s*false/.test(section);
});

if (missing.length || gatewayMismatches.length || presentForbidden.length || missingEndpointFunctions.length) {
  const failures = [
    ...missing.map(([, , label]) => label),
    ...gatewayMismatches.map((name) => `gateway verify_jwt=false for ${name}`),
    ...presentForbidden.map(([, , label]) => `remove ${label}`),
    ...missingEndpointFunctions.map((entry) => `missing Edge Function for client endpoint ${entry}`),
  ];
  console.error(`API check failed: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(
    `API check passed (${requiredFiles.length} shared modules, ${invariants.length} invariants, ${endpointReferences.size} client Edge Function contracts, ${publicHandlerFunctions.length} public/secret-verified gateway contracts).`,
  );
}
