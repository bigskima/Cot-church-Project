import { access, readFile } from 'node:fs/promises';

const files = [
  'apps/mobile/src/api.ts',
  'apps/mobile/src/state/session.tsx',
  'apps/mobile/src/hooks/use-resource.ts',
  'apps/mobile/src/components/cards.tsx',
  'apps/mobile/app/(tabs)/home/index.tsx',
  'apps/mobile/app/(tabs)/discover/index.tsx',
  'apps/mobile/app/(tabs)/live/index.tsx',
  'apps/mobile/app/(tabs)/live/[id].tsx',
  'apps/mobile/app/watch/[id].tsx',
  'apps/mobile/src/components/media/VideoPlayer.tsx',
  'apps/mobile/src/components/media/AudioPlayer.tsx',
  'apps/mobile/app/sermon/[id].tsx',
  'apps/mobile/app/series/[id].tsx',
  'apps/mobile/app/(tabs)/community/index.tsx',
  'apps/mobile/app/(tabs)/profile/index.tsx',
  'apps/mobile/app/expressions/index.tsx',
  'apps/mobile/app/leadership/invite-codes.tsx',
  'apps/mobile/app/reels.tsx',
  'apps/mobile/app/expression/[id]/index.tsx',
  'apps/mobile/app/event/[id].tsx',
  'apps/mobile/src/features/giving/GivingScreen.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/giving-manage.tsx',
  'apps/admin/src/components/Shell.tsx',
  'apps/admin/src/pages/IntegrationsJobs.tsx',
  'apps/admin/src/pages/PaymentInfrastructure.tsx',
  'apps/admin/src/api.ts',
  'supabase/functions/stream-access/index.ts',
  'supabase/functions/stream-presence/index.ts',
  'supabase/functions/live-interactions/index.ts',
];

await Promise.all(files.map((file) => access(file)));
const sources = new Map(
  await Promise.all(files.map(async (file) => [file, await readFile(file, 'utf8')]))
);
const joined = [...sources.values()].join('\n');
const givingUi = [
  sources.get('apps/mobile/src/features/giving/GivingScreen.tsx') ?? '',
  sources.get('apps/mobile/app/(tabs)/profile/leadership/giving-manage.tsx') ?? '',
].join('\n');
const integrationsUi = sources.get('apps/admin/src/pages/IntegrationsJobs.tsx') ?? '';
const platformShellUi = sources.get('apps/admin/src/components/Shell.tsx') ?? '';
const paymentInfrastructureUi = sources.get('apps/admin/src/pages/PaymentInfrastructure.tsx') ?? '';

const checks = [
  [/expo-secure-store/, 'secure session persistence'],
  [/AbortController/, 'cancelled obsolete queries'],
  [/home.*discover.*live.*community.*profile/is, 'five product tabs'],
  [/LiveCard/, 'reusable live media'],
  [/VideoView/, 'native live player'],
  [/viewerSessionId/, 'live attendance'],
  [/follow_up/, 'private live follow-up'],
  [/social-feed/, 'scoped social experience'],
  [/ResourceError/, 'section error states'],
  [/stream-access/, 'secure playback access'],
  [/public-giving/, 'tenant-safe giving resolver'],
  [/manualBankTransfer/, 'manual transfer production giving'],
  [/Church-wide/, 'church-wide giving scope'],
  [/Expression Giving Settings/, 'expression-owned giving settings'],
  [/Currency is (?:configuration|data), not (?:code|application code)/, 'currency-neutral giving configuration'],
  [/effectivePermissions/, 'permission-aware Platform Administration navigation'],
  [/platform-integrations/, 'real platform integration telemetry'],
  [/retry_job/, 'failed integration job retry'],
  [/set_connection_status/, 'integration connection governance'],
  [/Notification delivery/, 'notification queue telemetry'],
  [/Workflow execution/, 'workflow queue telemetry'],
  [/Integration delivery/, 'delivery queue telemetry'],
  [/signature_valid/, 'streaming webhook verification visibility'],
  [/signature_verified/, 'payment webhook verification visibility'],
  [/isStoredAuth/, 'validated mobile stored session'],
  [/isAuthState/, 'validated admin stored session'],
  [/Join an Expression/, 'public Expression join entry point'],
  [/enterExpression/, 'deliberate Expression entry'],
  [/leaveExpression/, 'deliberate Expression exit'],
  [/action: 'preview'/, 'invite-code preview flow'],
  [/action: 'redeem'/, 'invite-code redemption flow'],
  [/action: 'generate'/, 'invite-code generation flow'],
  [/codeId/, 'invite-code revocation flow'],
  [/context: 'public'/, 'public interaction request scope'],
  [/clearContextResources/, 'Expression cache invalidation'],
  [/public-content\?type=event&id=/, 'exact public event detail request'],
  [/Cancel Registration/, 'event registration cancellation action'],
  [/Registration Not Open/, 'event registration opening state'],
  [/Registration Closed/, 'event registration closing state'],
  [/public-content\?type=video&id=/, 'exact public video detail request'],
  [/view=state/, 'server-backed video engagement state'],
  [/action: isLiked \? 'unreact' : 'react'/, 'confirmed like and unlike flow'],
  [/action: 'sync_playback'/, 'cross-device playback progress sync'],
  [/initialPositionSeconds/, 'playback position restoration'],
  [/content-media\?action=playback/, 'signed video playback resolution'],
  [/comments\.refresh\(\)/, 'comment refresh after posting'],
  [/pathname:\s*['"]\/\(auth\)\/login['"]/, 'protected interaction sign-in gating'],

  [/public-content\?type=sermon&id=/, 'exact public sermon detail request'],
  [/Enter this Expression to play its internal sermon/, 'Expression sermon playback guard'],
  [/onProgress=\{syncProgress\}/, 'sermon audio and video continuity'],
  [/useDeferredValue/, 'non-blocking public discovery search'],
  [/type: 'search'/, 'server-backed public discovery search'],
  [/PUBLIC EXPRESSION PROFILE/, 'public Expression search result boundary'],
  [/public-content\?type=series-detail&id=/, 'exact sermon series detail request'],
  [/No published messages/, 'empty sermon series state'],
  [/EXPRESSION_MEMBERSHIP_REQUIRED/, 'not-a-member state mapping'],
];

const forbiddenGivingPatterns = [
  [/card_mock_provider/, 'mock payment provider'],
  [/giving\/checkout/, 'nonexistent online giving checkout route'],
  [/QUICK_AMOUNTS|quickAmounts/, 'hardcoded giving amounts'],
  [/givingPurposes/, 'hardcoded giving purpose list'],
  [/useState\(['"]USD['"]\)/, 'hardcoded USD default'],
  [/\$\{?amount|\$20|\$50|\$100|\$250|\$500/, 'hardcoded dollar giving presentation'],
];

const forbiddenPlatformBoundaryPatterns = [
  [/platform\.giving\.(?:read|manage)|GivingConfiguration|key:\s*['"]giving['"]/, 'platform-owned church giving route'],
];

const forbiddenIntegrationPatterns = [
  [/Just now|15m ago/, 'fabricated integration activity time'],
  [/< 85ms|4 Active|HEALTHY|OPTIMAL/, 'fabricated integration health metric'],
];

const paymentCredentialChecks = [
  [/category:\s*['"]payments['"]/, 'payment credential category contract'],
  [/providerCode:/, 'payment credential provider-code contract'],
];

const missing = checks.filter(([pattern]) => !pattern.test(joined));
const forbidden = forbiddenGivingPatterns.filter(([pattern]) => pattern.test(givingUi));
const forbiddenPlatformBoundaries = forbiddenPlatformBoundaryPatterns.filter(([pattern]) => pattern.test(platformShellUi));
const forbiddenIntegrations = forbiddenIntegrationPatterns.filter(([pattern]) => pattern.test(integrationsUi));
const missingPaymentCredentialChecks = paymentCredentialChecks.filter(([pattern]) => !pattern.test(paymentInfrastructureUi));

if (missing.length || forbidden.length || forbiddenPlatformBoundaries.length || forbiddenIntegrations.length || missingPaymentCredentialChecks.length) {
  const failures = [
    ...missing.map(([, name]) => name),
    ...forbidden.map(([, name]) => `remove ${name}`),
    ...forbiddenPlatformBoundaries.map(([, name]) => `remove ${name}`),
    ...forbiddenIntegrations.map(([, name]) => `remove ${name}`),
    ...missingPaymentCredentialChecks.map(([, name]) => name),
  ];
  console.error(`Application check failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log(
  `Application check passed (${files.length} files, ${checks.length} production invariants, ${forbiddenGivingPatterns.length + forbiddenPlatformBoundaryPatterns.length + forbiddenIntegrationPatterns.length} anti-hardcode/boundary checks, ${paymentCredentialChecks.length} payment contract checks).`,
);
