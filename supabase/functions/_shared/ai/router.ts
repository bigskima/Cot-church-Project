import { ApiError } from '../errors.ts';
import { adminClient } from '../supabase.ts';
import { aiProvider } from './registry.ts';
import type { AiCapability, AiRequest, AiResult } from './types.ts';

type ProviderRow = {
  code: string;
  secret_reference: string;
  status: string;
};

type Model = {
  id: string;
  model_key: string;
  input_cost_per_million: number | string;
  output_cost_per_million: number | string;
  ai_providers: ProviderRow | ProviderRow[];
};

type Route = {
  id: string;
  primary_model_id: string;
  fallback_model_ids: string[];
  timeout_ms: number;
  max_retries: number;
};

type UsageLimit = {
  capability_code: string | null;
  period: 'day' | 'month';
  max_requests: number | null;
  max_tokens: number | string | null;
  max_cost_minor: number | string | null;
};

const methodFor: Record<string, AiCapability> = {
  'assistant.answer': 'generateText',
  'sermon.summarize': 'generateStructuredData',
  'sermon.transcribe': 'transcribeAudio',
  'live.caption': 'transcribeAudio',
  'translate.text': 'translateText',
  'search.embed': 'createEmbeddings',
  'content.moderate': 'moderateContent',
  'pastoral.triage': 'generateStructuredData',
  'admin.insight': 'generateStructuredData',
};

async function digest(value: string) {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(result)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function routeFor(organizationId: string, capability: string): Promise<Route> {
  const admin = adminClient();
  const select = 'id,primary_model_id,fallback_model_ids,timeout_ms,max_retries';

  const { data: tenantRoute, error: tenantError } = await admin
    .from('ai_routes')
    .select(select)
    .eq('organization_id', organizationId)
    .eq('capability_code', capability)
    .eq('is_active', true)
    .maybeSingle();
  if (tenantError) throw new ApiError('AI_ROUTE_LOOKUP_FAILED', 'Unable to resolve the AI route', 500, undefined, false);
  if (tenantRoute) return tenantRoute as Route;

  const { data: globalRoute, error: globalError } = await admin
    .from('ai_routes')
    .select(select)
    .is('organization_id', null)
    .eq('capability_code', capability)
    .eq('is_active', true)
    .maybeSingle();
  if (globalError) throw new ApiError('AI_ROUTE_LOOKUP_FAILED', 'Unable to resolve the AI route', 500, undefined, false);
  if (!globalRoute) throw new ApiError('AI_ROUTE_UNAVAILABLE', 'No AI route is configured for this capability', 503);
  return globalRoute as Route;
}

async function modelFor(id: string): Promise<Model> {
  const { data, error } = await adminClient()
    .from('ai_models')
    .select('id,model_key,input_cost_per_million,output_cost_per_million,ai_providers!inner(code,secret_reference,status)')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) throw new ApiError('AI_MODEL_UNAVAILABLE', 'Configured AI model is unavailable', 503);
  return data as unknown as Model;
}

function startForPeriod(period: 'day' | 'month') {
  const start = new Date();
  if (period === 'month') {
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
  } else {
    start.setUTCHours(0, 0, 0, 0);
  }
  return start.toISOString();
}

async function enforceLimit(organizationId: string, capability: string) {
  const admin = adminClient();
  const { data, error } = await admin
    .from('ai_usage_limits')
    .select('capability_code,period,max_requests,max_tokens,max_cost_minor')
    .eq('is_active', true)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .or(`capability_code.eq.${capability},capability_code.is.null`);
  if (error) throw new ApiError('AI_LIMIT_LOOKUP_FAILED', 'Unable to verify AI usage limits', 500, undefined, false);

  for (const rawLimit of data ?? []) {
    const limit = rawLimit as UsageLimit;
    const { data: totals, error: totalError } = await admin
      .rpc('ai_usage_totals', {
        target_organization_id: organizationId,
        target_capability_code: limit.capability_code,
        period_start: startForPeriod(limit.period),
      })
      .single();
    if (totalError || !totals) throw new ApiError('AI_LIMIT_LOOKUP_FAILED', 'Unable to calculate AI usage', 500, undefined, false);

    const requestCount = Number(totals.request_count ?? 0);
    const tokenCount = Number(totals.token_count ?? 0);
    const costMinor = Number(totals.cost_minor ?? 0);
    if (
      (limit.max_requests !== null && requestCount >= Number(limit.max_requests)) ||
      (limit.max_tokens !== null && tokenCount >= Number(limit.max_tokens)) ||
      (limit.max_cost_minor !== null && costMinor >= Number(limit.max_cost_minor))
    ) {
      throw new ApiError('AI_USAGE_LIMIT_REACHED', 'AI usage limit has been reached for this period', 429);
    }
  }
}

function providerFrom(model: Model) {
  return Array.isArray(model.ai_providers) ? model.ai_providers[0] : model.ai_providers;
}

async function invoke(model: Model, capability: AiCapability, request: AiRequest, signal: AbortSignal): Promise<AiResult> {
  const providerRow = providerFrom(model);
  if (!providerRow) throw new ApiError('AI_PROVIDER_UNAVAILABLE', 'Configured AI provider is unavailable', 503);
  const provider = aiProvider(providerRow.code);
  if (providerRow.status !== 'active' || !provider.supports(capability)) {
    throw new ApiError('AI_CAPABILITY_UNAVAILABLE', `${providerRow.code} cannot serve ${capability}`, 503);
  }

  const prepared = { ...request, model: model.model_key };
  switch (capability) {
    case 'generateText':
      return provider.generateText(providerRow.secret_reference, prepared, signal);
    case 'generateStructuredData':
      return provider.generateStructuredData(providerRow.secret_reference, prepared, signal);
    case 'translateText':
      return provider.translateText(providerRow.secret_reference, prepared, signal);
    case 'createEmbeddings':
      return provider.createEmbeddings(providerRow.secret_reference, prepared, signal);
    case 'moderateContent':
      return provider.moderateContent(providerRow.secret_reference, prepared, signal);
    case 'analyzeImage':
      return provider.analyzeImage(providerRow.secret_reference, prepared, signal);
    default:
      throw new ApiError('AI_CAPABILITY_UNAVAILABLE', 'This capability requires a specialized media endpoint', 501);
  }
}

export async function runAi(input: {
  organizationId: string;
  profileId: string;
  capabilityCode: string;
  request: AiRequest;
  entityType?: string;
  entityId?: string;
}) {
  await enforceLimit(input.organizationId, input.capabilityCode);

  const admin = adminClient();
  const route = await routeFor(input.organizationId, input.capabilityCode);
  const { data: capability, error: capabilityError } = await admin
    .from('ai_capabilities')
    .select('requires_human_review')
    .eq('code', input.capabilityCode)
    .single();
  if (capabilityError || !capability) throw new ApiError('AI_CAPABILITY_UNAVAILABLE', 'AI capability configuration is unavailable', 503);

  const { data: run, error: runError } = await admin
    .from('ai_generation_runs')
    .insert({
      organization_id: input.organizationId,
      profile_id: input.profileId,
      capability_code: input.capabilityCode,
      route_id: route.id,
      status: 'running',
      input_sha256: await digest(JSON.stringify(input.request)),
      scoped_entity_type: input.entityType,
      scoped_entity_id: input.entityId,
    })
    .select('id')
    .single();
  if (runError || !run) throw new ApiError('AI_RUN_CREATE_FAILED', 'Unable to create AI audit record', 500, undefined, false);

  const candidates = [route.primary_model_id, ...(route.fallback_model_ids ?? [])];
  const started = performance.now();
  let lastError: unknown;

  for (let modelIndex = 0; modelIndex < candidates.length; modelIndex += 1) {
    let model: Model;
    try {
      model = await modelFor(candidates[modelIndex]);
    } catch (error) {
      lastError = error;
      continue;
    }

    for (let attempt = 0; attempt <= route.max_retries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), route.timeout_ms);
        let result: AiResult;
        try {
          result = await invoke(model, methodFor[input.capabilityCode] ?? 'generateText', input.request, controller.signal);
        } finally {
          clearTimeout(timer);
        }

        const inputRate = Number(model.input_cost_per_million ?? 0);
        const outputRate = Number(model.output_cost_per_million ?? 0);
        const cost = Math.ceil((((result.inputTokens ?? 0) * inputRate + (result.outputTokens ?? 0) * outputRate) / 1_000_000) * 100);
        const status = capability.requires_human_review ? 'requires_review' : 'succeeded';
        const providerRow = providerFrom(model);

        const { error: completionError } = await admin
          .from('ai_generation_runs')
          .update({
            model_id: model.id,
            status,
            output: result.content,
            input_tokens: result.inputTokens,
            output_tokens: result.outputTokens,
            estimated_cost_minor: cost,
            latency_ms: Math.round(performance.now() - started),
            provider_request_id: result.providerRequestId,
            fallback_count: modelIndex,
            completed_at: new Date().toISOString(),
          })
          .eq('id', run.id);
        if (completionError) throw new ApiError('AI_RUN_UPDATE_FAILED', 'AI completed but the audit record could not be finalized', 500, undefined, false);

        if (capability.requires_human_review) {
          const { error: draftError } = await admin.from('ai_content_drafts').insert({
            organization_id: input.organizationId,
            run_id: run.id,
            content_type: input.capabilityCode,
            content: typeof result.content === 'object' ? result.content : { text: result.content },
            created_by: input.profileId,
          });
          if (draftError) throw new ApiError('AI_REVIEW_DRAFT_FAILED', 'AI output was generated but the review draft could not be created', 500, undefined, false);
        }

        return {
          runId: run.id,
          status,
          content: result.content,
          provider: providerRow?.code,
          model: model.model_key,
          fallbackUsed: modelIndex > 0,
        };
      } catch (error) {
        lastError = error;
        if (error instanceof ApiError && error.code === 'AI_RUN_UPDATE_FAILED') break;
      }
    }
  }

  await admin
    .from('ai_generation_runs')
    .update({
      status: 'failed',
      error_code: lastError instanceof ApiError ? lastError.code : 'AI_ALL_PROVIDERS_FAILED',
      error_message: lastError instanceof Error ? lastError.message : 'All providers failed',
      latency_ms: Math.round(performance.now() - started),
      fallback_count: Math.max(0, candidates.length - 1),
      completed_at: new Date().toISOString(),
    })
    .eq('id', run.id);

  throw new ApiError('AI_ALL_PROVIDERS_FAILED', 'All configured AI providers failed', 502, undefined, false);
}
