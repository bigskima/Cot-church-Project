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
  'supabase/functions/membership-invitations/index.ts',
  'supabase/functions/expression-memberships/index.ts',
  'supabase/functions/_shared/rate-limit.ts',
  'supabase/functions/giving/index.ts',
  'supabase/functions/public-giving/index.ts',
  'supabase/functions/finance/index.ts',
  'supabase/functions/payment-events/index.ts',
  'supabase/functions/live-streams/index.ts',
  'supabase/functions/social-feed/index.ts',
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
  'supabase/functions/platform-audit/index.ts',
  'supabase/functions/platform-streaming/index.ts',
  'supabase/functions/platform-ai/index.ts',
  'supabase/functions/platform-features/index.ts',
  'supabase/functions/platform-integrations/index.ts',
  'supabase/functions/platform-payments/index.ts',
  'supabase/functions/platform-giving/index.ts',
];

await Promise.all(requiredFiles.map((file) => access(file)));

const handler = await readFile('supabase/functions/_shared/handler.ts', 'utf8');
const response = await readFile('supabase/functions/_shared/response.ts', 'utf8');
const signup = await readFile('supabase/functions/signup/index.ts', 'utf8');
const organizationContext = await readFile('supabase/functions/organization-context/index.ts', 'utf8');
const login = await readFile('supabase/functions/login/index.ts', 'utf8');
const refreshSession = await readFile('supabase/functions/refresh-session/index.ts', 'utf8');
const passwordReset = await readFile('supabase/functions/password-reset/index.ts', 'utf8');
const organizations = await readFile('supabase/functions/organizations/index.ts', 'utf8');
const memberships = await readFile('supabase/functions/memberships/index.ts', 'utf8');
const expressionMemberships = await readFile('supabase/functions/expression-memberships/index.ts', 'utf8');
const roles = await readFile('supabase/functions/roles/index.ts', 'utf8');
const events = await readFile('supabase/functions/events/index.ts', 'utf8');
const signupRateLimited = await readFile('supabase/functions/signup/index.ts', 'utf8');
const paymentEvents = await readFile('supabase/functions/payment-events/index.ts', 'utf8');
const publicContent = await readFile('supabase/functions/public-content/index.ts', 'utf8');
const engagement = await readFile('supabase/functions/engagement/index.ts', 'utf8');
const homeFeed = await readFile('supabase/functions/home-feed/index.ts', 'utf8');
const feedRanking = await readFile('supabase/functions/_shared/feed-ranking.ts', 'utf8');
const eventRegistrations = await readFile('supabase/functions/event-registrations/index.ts', 'utf8');
const sermons = await readFile('supabase/functions/sermons/index.ts', 'utf8');
const branding = await readFile('supabase/functions/branding/index.ts', 'utf8');
const churchStory = await readFile('supabase/functions/church-story/index.ts', 'utf8');
const giving = await readFile('supabase/functions/giving/index.ts', 'utf8');
const publicGiving = await readFile('supabase/functions/public-giving/index.ts', 'utf8');
const platformGiving = await readFile('supabase/functions/platform-giving/index.ts', 'utf8');
const platformPayments = await readFile('supabase/functions/platform-payments/index.ts', 'utf8');
const platformStreaming = await readFile('supabase/functions/platform-streaming/index.ts', 'utf8');
const platformAi = await readFile('supabase/functions/platform-ai/index.ts', 'utf8');
const platformFeatures = await readFile('supabase/functions/platform-features/index.ts', 'utf8');
const platformIntegrations = await readFile('supabase/functions/platform-integrations/index.ts', 'utf8');
const gatewayConfig = await readFile('supabase/config.toml', 'utf8');

const invariants = [
  [handler, /request\.method === "OPTIONS"/, 'CORS preflight handling'],
  [handler, /authenticate\(request/, 'central authentication'],
  [handler, /authorize\(auth/, 'central authorization'],
  [handler, /api_request_failed/, 'structured failure logging'],
  [response, /requestId/, 'request IDs in response envelopes'],
  [response, /Cache-Control.*no-store/, 'no-store response caching'],
  [signup, /client\.auth\.signUp/, 'Supabase Auth signup'],
  [signup, /assertNoUnknownFields/, 'strict signup validation'],
  [organizationContext, /effectivePermissions/, 'effective permission resolution'],
  [organizationContext, /expressionMemberships/, 'multiple Expression membership resolution'],
  [organizationContext, /requestedExpressionMembership/, 'deliberate exact Expression context resolution'],
  [expressionMemberships, /expression-invite-preview/, 'Expression invite preview rate limiting'],
  [expressionMemberships, /expression-invite-redeem/, 'Expression invite redemption rate limiting'],
  [expressionMemberships, /generate_expression_invite_code/, 'server-generated Expression invite codes'],
  [expressionMemberships, /revoke_expression_invite_code/, 'Expression invite revocation'],
  [publicContent, /type === "expression"/, 'public Expression profile contract'],
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
  [passwordReset, /updateUserById/, 'server-side password reset completion'],
  [organizations, /create_organization/, 'transactional organization provisioning'],
  [memberships, /update_membership_status/, 'protected membership lifecycle'],
  [roles, /create_custom_role/, 'custom role administration'],
  [events, /events\.create/, 'event authorization'],
  [signupRateLimited, /enforceRateLimit/, 'signup rate limiting'],
  [paymentEvents, /HMAC/, 'payment event signature validation'],
  [publicContent, /visibility.*public/, 'public content visibility enforcement'],
  [sermons, /sermons\.create/, 'sermon authorization'],
  [branding, /platform\.branding\.manage/, 'branding authorization'],
  [churchStory, /leadership_profiles/, 'leadership profile management'],
  [giving, /requireExpression\(auth\.branchId\)/, 'expression giving management requires expression context'],
  [giving, /online_payment_enabled:\s*false/, 'expression online giving remains unavailable'],
  [publicGiving, /ORGANIZATION_REQUIRED/, 'public giving requires explicit church scope'],
  [publicGiving, /expressionId/, 'public giving supports explicit expression scope'],
  [publicGiving, /manualBankTransfer/, 'manual transfer is exposed as a server-driven giving method'],
  [platformGiving, /authorizePlatform\(auth, "platform\.giving\.read"\)/, 'Level-1 church-wide giving read authorization'],
  [platformGiving, /authorizePlatform\(auth, "platform\.giving\.manage"\)/, 'Level-1 church-wide giving manage authorization'],
  [platformGiving, /ONLINE_GIVING_NOT_READY/, 'online giving cannot be enabled before real provider integration'],
  [platformGiving, /currency.*3-letter ISO/s, 'currency-neutral giving account validation'],
  [platformPayments, /authorizePlatform\(auth, "platform\.payments\.read"\)/, 'Level-1 payment read authorization'],
  [platformPayments, /authorizePlatform\(auth, "platform\.payments\.manage"\)/, 'Level-1 payment manage authorization'],
  [platformPayments, /payment_provider_configs/, 'database-driven payment provider configuration'],
  [platformPayments, /platform_audit_log/, 'payment governance audit trail'],
  [platformPayments, /Deno\.env\.get\(config\.secret_reference\)/, 'runtime secret-reference validation before provider activation'],
  [platformStreaming, /platform\.streaming\./, 'Level-1 streaming authority'],
  [platformAi, /platform\.ai\./, 'Level-1 AI authority'],
  [platformFeatures, /platform\.features\./, 'Level-1 feature authority'],
  [platformIntegrations, /platform\.integrations\./, 'Level-1 integrations authority'],
];

const missing = invariants.filter(([source, pattern]) => !pattern.test(source));
const forbidden = [
  [churchStory, /Foundation & First Gathering|Multi-Expression Expansion|Global Digital Ministry/, 'fabricated church story fallback'],
  [signup, /password\(body\.password\)/, 'hardcoded signup password policy'],
  [signup, /length\s*<\s*\d+.*password|password.*length\s*<\s*\d+/s, 'hardcoded signup password length rule'],
];
const presentForbidden = forbidden.filter(([source, pattern]) => pattern.test(source));

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

if (missing.length || gatewayMismatches.length || presentForbidden.length) {
  const failures = [
    ...missing.map(([, , label]) => label),
    ...gatewayMismatches.map((name) => `gateway verify_jwt=false for ${name}`),
    ...presentForbidden.map(([, , label]) => `remove ${label}`),
  ];
  console.error(`API check failed: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(
    `API check passed (${requiredFiles.length} shared modules, ${invariants.length} invariants, ${publicHandlerFunctions.length} public/secret-verified gateway contracts).`,
  );
}
