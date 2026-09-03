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
  'supabase/functions/signup/index.ts',
  'supabase/functions/password-recovery/index.ts',
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
  'supabase/functions/_shared/rate-limit.ts',
  'supabase/functions/giving/index.ts',
  'supabase/functions/finance/index.ts',
  'supabase/functions/payment-events/index.ts',
  'supabase/functions/live-streams/index.ts',
  'supabase/functions/social-feed/index.ts',
  'supabase/functions/public-content/index.ts',
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
];

await Promise.all(requiredFiles.map((file) => access(file)));

const handler = await readFile('supabase/functions/_shared/handler.ts', 'utf8');
const response = await readFile('supabase/functions/_shared/response.ts', 'utf8');
const signup = await readFile('supabase/functions/signup/index.ts', 'utf8');
const organizationContext = await readFile('supabase/functions/organization-context/index.ts', 'utf8');
const login = await readFile('supabase/functions/login/index.ts', 'utf8');
const organizations = await readFile('supabase/functions/organizations/index.ts', 'utf8');
const memberships = await readFile('supabase/functions/memberships/index.ts', 'utf8');
const roles = await readFile('supabase/functions/roles/index.ts', 'utf8');
const events = await readFile('supabase/functions/events/index.ts', 'utf8');
const signupRateLimited = await readFile('supabase/functions/signup/index.ts', 'utf8');
const paymentEvents = await readFile('supabase/functions/payment-events/index.ts', 'utf8');
const publicContent = await readFile('supabase/functions/public-content/index.ts', 'utf8');
const sermons = await readFile('supabase/functions/sermons/index.ts', 'utf8');
const branding = await readFile('supabase/functions/branding/index.ts', 'utf8');
const churchStory = await readFile('supabase/functions/church-story/index.ts', 'utf8');
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
  [login, /signInWithPassword/, 'password login workflow'],
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
];

const missing = invariants.filter(([source, pattern]) => !pattern.test(source));

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

if (missing.length || gatewayMismatches.length) {
  const failures = [
    ...missing.map(([, , label]) => label),
    ...gatewayMismatches.map((name) => `gateway verify_jwt=false for ${name}`),
  ];
  console.error(`API check failed: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(
    `API check passed (${requiredFiles.length} shared modules, ${invariants.length} invariants, ${publicHandlerFunctions.length} public/secret-verified gateway contracts).`,
  );
}
