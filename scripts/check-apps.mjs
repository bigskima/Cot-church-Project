import { access, readFile } from 'node:fs/promises';

const files = [
  'apps/mobile/src/api.ts',
  'apps/mobile/src/state/session.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/expressions-manage.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/index.tsx',
  'apps/mobile/app/_layout.tsx',
  'apps/mobile/src/hooks/use-resource.ts',
  'apps/mobile/src/services/query-cache.ts',
  'apps/mobile/src/components/cards.tsx',
  'apps/mobile/app/(tabs)/home/index.tsx',
  'apps/mobile/app/(tabs)/discover/index.tsx',
  'apps/mobile/app/(tabs)/live/index.tsx',
  'apps/mobile/app/(tabs)/live/[id].tsx',
  'apps/mobile/app/watch/[id].tsx',
  'apps/mobile/src/components/cards/VideoCard.tsx',
  'apps/mobile/src/components/media/VideoPlayer.tsx',
  'apps/mobile/src/components/media/AudioPlayer.tsx',
  'apps/mobile/app/sermon/[id].tsx',
  'apps/mobile/app/series/[id].tsx',
  'apps/mobile/app/(tabs)/community/index.tsx',
  'apps/mobile/app/(tabs)/profile/index.tsx',
  'apps/mobile/app/(tabs)/profile/settings.tsx',
  'apps/mobile/app/expressions/index.tsx',
  'apps/mobile/app/leadership/invite-codes.tsx',
  'apps/mobile/app/reels.tsx',
  'apps/mobile/app/expression/[id]/index.tsx',
  'apps/mobile/app/event/[id].tsx',
  'apps/mobile/app/prayer/index.tsx',
  'apps/mobile/src/components/prayer/PrayerCard.tsx',
  'apps/mobile/src/features/giving/GivingScreen.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/giving-manage.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/media-studio.tsx',
  'apps/mobile/app/studio/index.tsx',
  'apps/admin/src/pages/RolesAccess.tsx',
  'apps/admin/src/components/Shell.tsx',
  'apps/admin/src/pages/IntegrationsJobs.tsx',
  'apps/admin/src/pages/PaymentInfrastructure.tsx',
  'apps/admin/src/api.ts',
  'supabase/functions/streaming-broadcasts/index.ts',
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
const prayerUi = [
  sources.get('apps/mobile/app/prayer/index.tsx') ?? '',
  sources.get('apps/mobile/src/components/prayer/PrayerCard.tsx') ?? '',
].join('\n');
const integrationsUi = sources.get('apps/admin/src/pages/IntegrationsJobs.tsx') ?? '';
const platformShellUi = sources.get('apps/admin/src/components/Shell.tsx') ?? '';
const paymentInfrastructureUi = sources.get('apps/admin/src/pages/PaymentInfrastructure.tsx') ?? '';
const profileSettingsUi = sources.get('apps/mobile/app/(tabs)/profile/settings.tsx') ?? '';
const sessionUi = sources.get('apps/mobile/src/state/session.tsx') ?? '';

const checks = [
  [/expo-secure-store/, 'secure session persistence'],
  [/AbortController/, 'cancelled obsolete queries'],
  [/cacheSnapshot/, 'stale scoped cache visibility'],
  [/stale: boolean/, 'resource stale-data state'],
  [/contextStatus/, 'deterministic membership context state'],
  [/contextRefreshing/, 'background membership refresh state'],
  [/accessReady/, 'resolved access gate for permission-driven UI'],
  [/Loading your COT access/, 'app shell waits for resolved role access'],
  [/firstMembershipOrganization = value\.organizations\[0\]/, 'creator bootstrap authority is not persisted as membership context'],
  [/creatorOrganizations\?\.some/, 'Expression creator gating uses resolved membership context'],
  [/Resolving Platform Administration access/, 'admin shell waits for resolved platform authority'],
  [/setInterval\(refreshContext, 120_000\)/, 'role grants refresh without re-login'],
  [/hasPublicCapability\('public\.live_stream\.create'\)[\s\S]*Go live/, 'assigned public broadcaster live entry point'],
  [/failed background refresh must not blank already-resolved context/, 'membership refresh preserves resolved context'],
  [/home.*discover.*live.*community.*profile/is, 'five product tabs'],
  [/LiveCard/, 'reusable live media'],
  [/VideoView/, 'native live player'],
  [/viewerSessionId/, 'live attendance'],
  [/REPLAY PROCESSING|PROCESSING/, 'livestream lifecycle-aware player states'],
  [/Live fellowship opens when this broadcast begins/, 'pre-live fellowship state'],
  [/Replays & recordings/, 'recording processing and replay discovery'],
  [/follow_up/, 'private live follow-up'],
  [/social-feed/, 'scoped social experience'],
  [/ResourceError/, 'section error states'],
  [/stream-access/, 'secure playback access'],
  [/public-giving/, 'tenant-safe giving resolver'],
  [/manualBankTransfer/, 'manual transfer production giving'],
  [/Church-wide/, 'church-wide giving scope'],
  [/Expression Giving Settings/, 'expression-owned giving settings'],
  [/details\?\.currencies\s*\?\?\s*\[\]/, 'server-driven giving currencies'],
  [/account\.currency\s*===\s*currency/, 'currency-filtered giving accounts'],
  [/effectivePermissions/, 'permission-aware Platform Administration navigation'],
  [/Roles & Access/, 'Platform Administration Roles & Access workspace'],
  [/public\.live_stream\.create/, 'public livestream capability UI'],
  [/hasPublicCapability/, 'public capability helper separate from Expression permissions'],
  [/General Community[\s\S]*Expression role/, 'public COT role is separate from Expression roles'],
  [/visibility: broadcastScope === 'public' \? 'public' : 'branch'/, 'live broadcast destination follows selected scope'],
  [/This livestream remains scoped to the selected Expression/, 'Expression livestream privacy copy'],
  [/Create public broadcasts from General Community/, 'backend-enforced public livestream separation'],
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
  [/creatorOrganizations[\s\S]*Create Expression/, 'authorized Expression creator direct entry'],
  [/enterExpression/, 'deliberate Expression entry'],
  [/leaveExpression/, 'deliberate Expression exit'],
  [/action: 'preview'/, 'invite-code preview flow'],
  [/action: 'redeem'/, 'invite-code redemption flow'],
  [/action: 'generate'/, 'invite-code generation flow'],
  [/codeId/, 'invite-code revocation flow'],
  [/context: 'public'/, 'public interaction request scope'],
  [/canPostGeneral[\s\S]*mode === 'authenticated' && Boolean\(organizationId\)/, 'signed-in General Community publishing'],
  [/organizationId,[\s\S]*visibility: postDestination === 'expression' \? 'branch' : 'public'/, 'explicit public post destination'],
  [/action: 'share_reel'[\s\S]*organizationId/, 'signed-in public Reel sharing'],
  [/api\.request<ProfilePayload>\('profile', \{ context: 'public' \}\)/, 'profile read is independent of church membership context'],
  [/profile-avatar'[\s\S]*context: 'public'/, 'profile photo changes are independent of church membership context'],
  [/updateContextProfile/, 'profile changes update shared session data without reselecting church context'],
  [/clearContextResources/, 'Expression cache invalidation'],
  [/public-content\?type=event&id=/, 'exact public event detail request'],
  [/Cancel Registration/, 'event registration cancellation action'],
  [/Registration Not Open/, 'event registration opening state'],
  [/Registration Closed/, 'event registration closing state'],
  [/public-content\?type=video&id=/, 'exact public video detail request'],
  [/content-media\?action=video_detail&id=/, 'exact scoped Watch detail request'],
  [/Video is being prepared/, 'Watch media processing state'],
  [/More to watch/, 'neutral long-form related-content wording'],
  [/creatorAvatar[\s\S]*creatorName[\s\S]*sourceName/, 'real Watch creator and source attribution'],
  [/onBookmark \? \([\s\S]*Options for/, 'video options render only when an action exists'],
  [/view=state/, 'server-backed video engagement state'],
  [/action: isLiked \? 'unreact' : 'react'/, 'confirmed like and unlike flow'],
  [/action: 'sync_playback'/, 'cross-device playback progress sync'],
  [/initialPositionSeconds/, 'playback position restoration'],
  [/content-media\?action=playback/, 'signed video playback resolution'],
  [/comments\.refresh\(\)/, 'comment refresh after posting'],
  [/pathname:\s*['"]\/\(auth\)\/login['"]/, 'protected interaction sign-in gating'],
  [/action:\s*['"]pray['"]/, 'prayer-wall support request'],
  [/viewer_has_prayed/, 'prayer support viewer state'],
  [/prayingIds/, 'prayer support pending state'],

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

const forbiddenWatchCopyPatterns = [
  [/Related Teachings/, 'sermon-only Watch related-content wording'],
];

const forbiddenPermissionGatePatterns = [
  [/expression-creators\?mode=self/, 'duplicate Expression creator self-fetch in role-gated UI'],
  [/hasCapability\(['"]branches\.create['"]\)/, 'legacy branches.create client gate for canonical Expression creation'],
];

const forbiddenSocialCopyPatterns = [
  [/Join an active Expression before sharing a Reel into General Community/, 'stale Expression-membership Reel sharing guidance'],
];

const forbiddenPrayerPatterns = [
  [/onPray=\{\(\)\s*=>\s*\{\s*\}\}/, 'no-op prayer interaction'],
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
const forbiddenPrayer = forbiddenPrayerPatterns.filter(([pattern]) => pattern.test(prayerUi));
const forbiddenPermissionGates = forbiddenPermissionGatePatterns.filter(([pattern]) => pattern.test(joined));
const forbiddenSocialCopy = forbiddenSocialCopyPatterns.filter(([pattern]) => pattern.test(joined));
const forbiddenWatchCopy = forbiddenWatchCopyPatterns.filter(([pattern]) => pattern.test(sources.get('apps/mobile/app/watch/[id].tsx') ?? ''));
const forbiddenPlatformBoundaries = forbiddenPlatformBoundaryPatterns.filter(([pattern]) => pattern.test(platformShellUi));
const forbiddenIntegrations = forbiddenIntegrationPatterns.filter(([pattern]) => pattern.test(integrationsUi));
const missingPaymentCredentialChecks = paymentCredentialChecks.filter(([pattern]) => !pattern.test(paymentInfrastructureUi));

if (missing.length || forbidden.length || forbiddenPrayer.length || forbiddenSocialCopy.length || forbiddenWatchCopy.length || forbiddenPlatformBoundaries.length || forbiddenIntegrations.length || missingPaymentCredentialChecks.length) {
  const failures = [
    ...missing.map(([, name]) => name),
    ...forbidden.map(([, name]) => `remove ${name}`),
    ...forbiddenPrayer.map(([, name]) => `remove ${name}`),
    ...forbiddenPermissionGates.map(([, name]) => `remove ${name}`),
    ...forbiddenSocialCopy.map(([, name]) => `remove ${name}`),
    ...forbiddenWatchCopy.map(([, name]) => `remove ${name}`),
    ...forbiddenPlatformBoundaries.map(([, name]) => `remove ${name}`),
    ...forbiddenIntegrations.map(([, name]) => `remove ${name}`),
    ...missingPaymentCredentialChecks.map(([, name]) => name),
  ];
  console.error(`Application check failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log(
  `Application check passed (${files.length} files, ${checks.length} production invariants, ${forbiddenGivingPatterns.length + forbiddenPrayerPatterns.length + forbiddenSocialCopyPatterns.length + forbiddenWatchCopyPatterns.length + forbiddenPlatformBoundaryPatterns.length + forbiddenIntegrationPatterns.length} anti-hardcode/boundary checks, ${paymentCredentialChecks.length} payment contract checks).`,
);
