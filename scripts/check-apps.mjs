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
  'apps/mobile/app/(tabs)/community/index.tsx',
  'apps/mobile/app/(tabs)/profile/index.tsx',
  'apps/mobile/src/features/giving/GivingScreen.tsx',
  'apps/mobile/app/(tabs)/profile/leadership/giving-manage.tsx',
  'apps/admin/src/pages/GivingConfiguration.tsx',
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
  sources.get('apps/admin/src/pages/GivingConfiguration.tsx') ?? '',
].join('\n');

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
];

const forbiddenGivingPatterns = [
  [/card_mock_provider/, 'mock payment provider'],
  [/giving\/checkout/, 'nonexistent online giving checkout route'],
  [/QUICK_AMOUNTS|quickAmounts/, 'hardcoded giving amounts'],
  [/givingPurposes/, 'hardcoded giving purpose list'],
  [/useState\(['"]USD['"]\)/, 'hardcoded USD default'],
  [/\$\{?amount|\$20|\$50|\$100|\$250|\$500/, 'hardcoded dollar giving presentation'],
];

const missing = checks.filter(([pattern]) => !pattern.test(joined));
const forbidden = forbiddenGivingPatterns.filter(([pattern]) => pattern.test(givingUi));

if (missing.length || forbidden.length) {
  const failures = [
    ...missing.map(([, name]) => name),
    ...forbidden.map(([, name]) => `remove ${name}`),
  ];
  console.error(`Application check failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log(
  `Application check passed (${files.length} files, ${checks.length} production invariants, ${forbiddenGivingPatterns.length} giving anti-hardcode checks).`,
);
