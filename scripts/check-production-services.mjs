import { access, readFile } from 'node:fs/promises';

const files = [
  'supabase/migrations/20260826100000_production_streaming.sql',
  'supabase/migrations/20260918103036_cot_streaming_provider_routing.sql',
  'supabase/migrations/20260918103125_fix_general_live_cache_claim.sql',
  'supabase/migrations/20260826110000_ai_gateway.sql',
  'supabase/functions/_shared/streaming/types.ts',
  'supabase/functions/_shared/streaming/configuration.ts',
  'supabase/functions/_shared/streaming/mux.ts',
  'supabase/functions/_shared/streaming/agora.ts',
  'supabase/functions/_shared/youtube-live.ts',
  'supabase/functions/home-feed/index.ts',
  'supabase/functions/streaming-broadcasts/index.ts',
  'supabase/functions/streaming-webhook/index.ts',
  'supabase/functions/stream-access/index.ts',
  'supabase/functions/platform-streaming/index.ts',
  'supabase/functions/_shared/ai/types.ts',
  'supabase/functions/_shared/ai/openai.ts',
  'supabase/functions/_shared/ai/gemini.ts',
  'supabase/functions/_shared/ai/anthropic.ts',
  'supabase/functions/_shared/ai/router.ts',
  'supabase/functions/ai-gateway/index.ts',
  'supabase/functions/ai-review/index.ts',
];

await Promise.all(files.map((file) => access(file)));
const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');

const invariants = [
  [/interface StreamingProvider/, 'streaming provider interface'],
  [/class MuxStreamingProvider/, 'Mux adapter remains installed'],
  [/rtmps:\/\/global-live\.mux\.com/, 'Mux RTMPS ingest remains available'],
  [/mux-signature/, 'Mux webhook verification remains available'],
  [/class AgoraStreamingProvider/, 'Agora Expression RTC adapter'],
  [/npm:agora-token@2\.0\.6/, 'pinned Agora server token package'],
  [/cohostAuthenticationEnabled/, 'Agora co-host authentication launch gate'],
  [/createRtcGrant/, 'role-scoped Agora RTC grants'],
  [/routingScopes/, 'General and Expression provider routing'],
  [/general_live_source_cache/, 'shared General YouTube live cache'],
  [/claim_general_live_source_refresh/, 'atomic YouTube discovery refresh claim'],
  [/resolveGeneralYouTubeLive/, 'YouTube General live resolver'],
  [/searchChannel[\s\S]*eventType/, 'YouTube live/upcoming channel discovery'],
  [/providerCode:\s*"youtube"/, 'YouTube external live stream contract'],
  [/rtcGrant/, 'RTC grant returned through existing streaming endpoints'],
  [/createPlaybackToken/, 'signed playback grants'],
  [/live_recordings/, 'recording persistence'],
  [/interface AiProvider/, 'AI provider interface'],
  [/class OpenAiProvider/, 'OpenAI adapter'],
  [/class GeminiProvider/, 'Gemini adapter'],
  [/class AnthropicProvider/, 'Anthropic adapter'],
  [/fallback_model_ids/, 'AI fallback routing'],
  [/ai_content_drafts/, 'human review drafts'],
  [/secretReference/, 'server-side secret references'],
];

const missing = invariants.filter(([pattern]) => !pattern.test(source));
if (missing.length) {
  console.error(`Production service check failed: ${missing.map(([, name]) => name).join(', ')}`);
  process.exit(1);
}

console.log(`Production service check passed (${files.length} files, ${invariants.length} invariants).`);
