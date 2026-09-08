import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const providerStatuses = new Set(["active", "disabled", "degraded"]);
const periods = new Set(["day", "month"]);

function secretReference(value: unknown, field: string, required = false) {
  if ((value === undefined || value === null || value === "") && !required) return null;
  const reference = requiredString(value, field, 128);
  if (!/^[A-Z][A-Z0-9_]{2,127}$/.test(reference)) {
    throw new ApiError("VALIDATION_FAILED", `${field} must be an environment/Vault secret reference`, 422, {
      [field]: "Use an uppercase secret name; never send the API key value.",
    });
  }
  return reference;
}

function nonNegativeNumber(value: unknown, field: string, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new ApiError("VALIDATION_FAILED", `${field} must be a non-negative number`, 422);
  return number;
}

async function credentialState(client: ReturnType<typeof adminClient>, reference: string | null | undefined) {
  if (!reference) return { configured: false, error: null as unknown };
  const environmentValue = Deno.env.get(reference);
  if (environmentValue) return { configured: true, error: null as unknown };
  const { data, error } = await client.rpc("resolve_runtime_secret", { target_reference: reference });
  return { configured: typeof data === "string" && data.length > 0, error };
}

async function ensureProviderRuntime(
  client: ReturnType<typeof adminClient>,
  provider: { id: string; configuration?: Record<string, unknown> | null },
) {
  const configuration = provider.configuration ?? {};
  const modelKey = typeof configuration.defaultModelKey === "string"
    ? configuration.defaultModelKey.trim()
    : "";
  if (!modelKey) return { modelId: null as string | null, routesCreated: 0 };

  const displayName = typeof configuration.defaultModelName === "string" && configuration.defaultModelName.trim()
    ? configuration.defaultModelName.trim()
    : modelKey;
  const contextWindowRaw = Number(configuration.defaultContextWindow ?? 0);
  const contextWindow = Number.isFinite(contextWindowRaw) && contextWindowRaw > 0
    ? Math.floor(contextWindowRaw)
    : null;

  const { data: existingModel, error: existingModelError } = await client
    .from("ai_models")
    .select("id")
    .eq("provider_id", provider.id)
    .eq("model_key", modelKey)
    .maybeSingle();
  if (existingModelError) throw new ApiError("AI_MODEL_LOOKUP_FAILED", "Unable to prepare the provider model", 500, undefined, false);

  let modelId = existingModel?.id ?? null;
  if (modelId) {
    const { error } = await client
      .from("ai_models")
      .update({ display_name: displayName, context_window: contextWindow, is_active: true })
      .eq("id", modelId);
    if (error) throw new ApiError("AI_MODEL_UPDATE_FAILED", "Unable to prepare the provider model", 500, undefined, false);
  } else {
    const { data, error } = await client
      .from("ai_models")
      .insert({
        provider_id: provider.id,
        model_key: modelKey,
        display_name: displayName,
        context_window: contextWindow,
        is_active: true,
        configuration: { managedBy: "provider-activation" },
      })
      .select("id")
      .single();
    if (error || !data) throw new ApiError("AI_MODEL_UPDATE_FAILED", "Unable to prepare the provider model", 500, undefined, false);
    modelId = data.id;
  }

  let routesCreated = 0;
  for (const capabilityCode of ["assistant.answer", "admin.help"]) {
    const { data: route, error: routeError } = await client
      .from("ai_routes")
      .select("id")
      .is("organization_id", null)
      .eq("capability_code", capabilityCode)
      .maybeSingle();
    if (routeError) throw new ApiError("AI_ROUTE_LOOKUP_FAILED", "Unable to prepare AI routing", 500, undefined, false);
    if (route?.id) continue;

    const { error } = await client.from("ai_routes").insert({
      organization_id: null,
      capability_code: capabilityCode,
      primary_model_id: modelId,
      fallback_model_ids: [],
      timeout_ms: 30000,
      max_retries: 1,
      is_active: true,
    });
    if (error) throw new ApiError("AI_ROUTE_UPDATE_FAILED", "Unable to prepare AI routing", 500, undefined, false);
    routesCreated += 1;
  }

  return { modelId, routesCreated };
}

Deno.serve(
  createHandler(
    { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
    async ({ request, requestId, auth }) => {
      if (!auth) throw new Error("Authentication context missing");
      const admin = adminClient();

      if (request.method === "GET") {
        await authorizePlatform(auth, "platform.ai.read");
        const [providersResult, modelsResult, capabilitiesResult, routesResult, limitsResult, recentRunsResult] = await Promise.all([
          admin.from("ai_providers").select("id,code,name,adapter_version,status,secret_reference,configuration,created_at,updated_at").order("name", { ascending: true }),
          admin.from("ai_models").select("id,provider_id,model_key,display_name,input_cost_per_million,output_cost_per_million,context_window,is_active,configuration,ai_providers(id,code,name,status)").order("display_name", { ascending: true }),
          admin.from("ai_capabilities").select("code,name,risk_level,requires_human_review,description").order("code", { ascending: true }),
          admin.from("ai_routes").select("id,capability_code,primary_model_id,fallback_model_ids,timeout_ms,max_retries,is_active,created_at,updated_at,ai_capabilities(code,name,risk_level,requires_human_review),ai_models(id,provider_id,model_key,display_name,is_active)").is("organization_id", null).order("capability_code", { ascending: true }),
          admin.from("ai_usage_limits").select("id,capability_code,period,max_requests,max_tokens,max_cost_minor,currency,is_active").is("organization_id", null).order("capability_code", { ascending: true, nullsFirst: true }),
          admin.from("ai_generation_runs").select("id,organization_id,profile_id,capability_code,status,model_id,input_tokens,output_tokens,estimated_cost_minor,latency_ms,error_code,fallback_count,created_at,completed_at").order("created_at", { ascending: false }).limit(50),
        ]);
        if (providersResult.error || modelsResult.error || capabilitiesResult.error || routesResult.error || limitsResult.error || recentRunsResult.error) {
          throw new ApiError("PLATFORM_AI_FAILED", "Unable to retrieve AI control-plane telemetry", 500, undefined, false);
        }
        const providers = await Promise.all((providersResult.data ?? []).map(async (provider) => {
          const state = await credentialState(admin, provider.secret_reference);
          return { ...provider, credential_configured: state.configured };
        }));
        return {
          data: {
            providers,
            models: modelsResult.data ?? [],
            capabilities: capabilitiesResult.data ?? [],
            globalRoutes: routesResult.data ?? [],
            globalLimits: limitsResult.data ?? [],
            recentRuns: recentRunsResult.data ?? [],
          },
        };
      }

      await authorizePlatform(auth, "platform.ai.manage");
      const body = assertObject(await jsonBody(request));
      const action = requiredString(body.action, "action", 48);

      if (action === "configure_provider") {
        assertNoUnknownFields(body, ["action", "providerId", "status", "secretReference", "configuration", "reason"]);
        const providerId = uuid(requiredString(body.providerId, "providerId", 64), "providerId", true)!;
        const status = requiredString(body.status, "status", 32);
        if (!providerStatuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Unsupported AI provider status", 422);
        const reason = optionalString(body.reason, "reason", 1000) ?? null;
        if (status !== "active" && !reason) throw new ApiError("VALIDATION_FAILED", "A reason is required when degrading or disabling an AI provider", 422, { reason: "Required" });
        if (body.configuration !== undefined && (!body.configuration || typeof body.configuration !== "object" || Array.isArray(body.configuration))) {
          throw new ApiError("VALIDATION_FAILED", "configuration must be an object", 422);
        }

        const { data: current, error: currentError } = await admin.from("ai_providers").select("id,code,name,status,secret_reference,configuration").eq("id", providerId).maybeSingle();
        if (currentError || !current) throw new ApiError("AI_PROVIDER_NOT_FOUND", "AI provider not found", 404);
        const nextSecretReference = body.secretReference !== undefined
          ? secretReference(body.secretReference, "secretReference", true)
          : current.secret_reference;
        if (status === "active") {
          const credential = await credentialState(admin, nextSecretReference);
          if (credential.error) throw new ApiError("AI_PROVIDER_CREDENTIAL_CHECK_FAILED", "Unable to verify the provider credential", 500, undefined, false);
          if (!credential.configured) {
            throw new ApiError("AI_PROVIDER_CREDENTIAL_MISSING", "Add this provider API key before activating it", 409, {
              secretReference: "A stored or deployment credential is required",
            });
          }
        }
        const updates: Record<string, unknown> = { status };
        if (body.secretReference !== undefined) updates.secret_reference = nextSecretReference;
        if (body.configuration !== undefined) updates.configuration = body.configuration;
        const { data: updated, error } = await admin.from("ai_providers").update(updates).eq("id", providerId).select("id,code,name,adapter_version,status,secret_reference,configuration,updated_at").single();
        if (error) throw new ApiError("AI_PROVIDER_UPDATE_FAILED", "Unable to update AI provider", 500, undefined, false);

        const bootstrap = status === "active"
          ? await ensureProviderRuntime(admin, {
              id: updated.id,
              configuration: updated.configuration as Record<string, unknown> | null,
            })
          : { modelId: null, routesCreated: 0 };

        await admin.from("platform_audit_log").insert({ actor_profile_id: auth.user.id, action: "ai.provider_configured", target_type: "ai_provider", target_id: providerId, request_id: requestId, metadata: { providerCode: current.code, previousStatus: current.status, newStatus: status, reason, secretReferenceChanged: body.secretReference !== undefined, runtimeModelId: bootstrap.modelId, routesCreated: bootstrap.routesCreated } });
        return { data: { ...updated, runtime: bootstrap } };
      }

      if (action === "upsert_model") {
        assertNoUnknownFields(body, ["action", "providerId", "modelId", "modelKey", "displayName", "inputCostPerMillion", "outputCostPerMillion", "contextWindow", "isActive", "configuration"]);
        const providerId = uuid(requiredString(body.providerId, "providerId", 64), "providerId", true)!;
        const modelId = body.modelId ? uuid(String(body.modelId), "modelId", true) : null;
        const modelKey = requiredString(body.modelKey, "modelKey", 160);
        const displayName = requiredString(body.displayName, "displayName", 160);
        const inputCost = nonNegativeNumber(body.inputCostPerMillion, "inputCostPerMillion");
        const outputCost = nonNegativeNumber(body.outputCostPerMillion, "outputCostPerMillion");
        const contextWindow = body.contextWindow === undefined || body.contextWindow === null || body.contextWindow === "" ? null : Math.floor(nonNegativeNumber(body.contextWindow, "contextWindow"));
        if (body.configuration !== undefined && (!body.configuration || typeof body.configuration !== "object" || Array.isArray(body.configuration))) throw new ApiError("VALIDATION_FAILED", "configuration must be an object", 422);
        const record = { provider_id: providerId, model_key: modelKey, display_name: displayName, input_cost_per_million: inputCost, output_cost_per_million: outputCost, context_window: contextWindow, is_active: body.isActive === undefined ? true : Boolean(body.isActive), configuration: body.configuration ?? {} };
        let saved;
        if (modelId) {
          const { data, error } = await admin.from("ai_models").update(record).eq("id", modelId).eq("provider_id", providerId).select().single();
          if (error) throw new ApiError("AI_MODEL_UPDATE_FAILED", "Unable to update AI model", 500, undefined, false);
          saved = data;
        } else {
          const { data: existing } = await admin.from("ai_models").select("id").eq("provider_id", providerId).eq("model_key", modelKey).maybeSingle();
          const query = existing?.id ? admin.from("ai_models").update(record).eq("id", existing.id) : admin.from("ai_models").insert(record);
          const { data, error } = await query.select().single();
          if (error) throw new ApiError("AI_MODEL_UPDATE_FAILED", "Unable to save AI model", 500, undefined, false);
          saved = data;
        }
        await admin.from("platform_audit_log").insert({ actor_profile_id: auth.user.id, action: "ai.model_saved", target_type: "ai_model", target_id: saved.id, request_id: requestId, metadata: { providerId, modelKey, isActive: saved.is_active } });
        return { data: saved };
      }

      if (action === "set_route") {
        assertNoUnknownFields(body, ["action", "capabilityCode", "primaryModelId", "fallbackModelIds", "timeoutMs", "maxRetries", "isActive"]);
        const capabilityCode = requiredString(body.capabilityCode, "capabilityCode", 120);
        const primaryModelId = uuid(requiredString(body.primaryModelId, "primaryModelId", 64), "primaryModelId", true)!;
        const fallbackRaw = Array.isArray(body.fallbackModelIds) ? body.fallbackModelIds : [];
        const fallbackModelIds = [...new Set(fallbackRaw.map((value) => uuid(String(value), "fallbackModelId", true)!))].filter((id) => id !== primaryModelId);
        const timeoutMs = Math.floor(nonNegativeNumber(body.timeoutMs, "timeoutMs", 30000));
        const maxRetries = Math.floor(nonNegativeNumber(body.maxRetries, "maxRetries", 1));
        if (timeoutMs < 1000 || timeoutMs > 300000 || maxRetries > 3) throw new ApiError("VALIDATION_FAILED", "Route timeout or retry policy is outside allowed bounds", 422);
        const { data: capability } = await admin.from("ai_capabilities").select("code").eq("code", capabilityCode).maybeSingle();
        if (!capability) throw new ApiError("AI_CAPABILITY_NOT_FOUND", "AI capability not found", 404);
        const modelIds = [primaryModelId, ...fallbackModelIds];
        const { data: models, error: modelsError } = await admin
          .from("ai_models")
          .select("id,is_active,ai_providers!inner(status)")
          .in("id", modelIds);
        const routeModelsReady =
          !modelsError &&
          (models ?? []).length === modelIds.length &&
          (models ?? []).every((model: any) => {
            const provider = Array.isArray(model.ai_providers) ? model.ai_providers[0] : model.ai_providers;
            return model.is_active && provider?.status === "active";
          });
        if (!routeModelsReady) {
          throw new ApiError("AI_ROUTE_MODEL_INVALID", "All route models must be active and belong to an active provider", 409);
        }
        const record = { organization_id: null, capability_code: capabilityCode, primary_model_id: primaryModelId, fallback_model_ids: fallbackModelIds, timeout_ms: timeoutMs, max_retries: maxRetries, is_active: body.isActive === undefined ? true : Boolean(body.isActive) };
        const { data: existing } = await admin.from("ai_routes").select("id").is("organization_id", null).eq("capability_code", capabilityCode).maybeSingle();
        const query = existing?.id ? admin.from("ai_routes").update(record).eq("id", existing.id) : admin.from("ai_routes").insert(record);
        const { data: saved, error } = await query.select().single();
        if (error) throw new ApiError("AI_ROUTE_UPDATE_FAILED", "Unable to save global AI route", 500, undefined, false);
        await admin.from("platform_audit_log").insert({ actor_profile_id: auth.user.id, action: "ai.route_saved", target_type: "ai_route", target_id: saved.id, request_id: requestId, metadata: { capabilityCode, primaryModelId, fallbackModelIds, timeoutMs, maxRetries, isActive: saved.is_active } });
        return { data: saved };
      }

      if (action === "set_usage_limit") {
        assertNoUnknownFields(body, ["action", "capabilityCode", "period", "maxRequests", "maxTokens", "maxCostMinor", "currency", "isActive"]);
        const capabilityCode = body.capabilityCode === null || body.capabilityCode === undefined || body.capabilityCode === "" ? null : requiredString(body.capabilityCode, "capabilityCode", 120);
        const period = requiredString(body.period, "period", 16);
        if (!periods.has(period)) throw new ApiError("VALIDATION_FAILED", "period must be day or month", 422);
        const maxRequests = body.maxRequests === undefined || body.maxRequests === null || body.maxRequests === "" ? null : Math.floor(nonNegativeNumber(body.maxRequests, "maxRequests"));
        const maxTokens = body.maxTokens === undefined || body.maxTokens === null || body.maxTokens === "" ? null : Math.floor(nonNegativeNumber(body.maxTokens, "maxTokens"));
        const maxCostMinor = body.maxCostMinor === undefined || body.maxCostMinor === null || body.maxCostMinor === "" ? null : Math.floor(nonNegativeNumber(body.maxCostMinor, "maxCostMinor"));
        const currency = (optionalString(body.currency, "currency", 3) ?? "USD").toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) throw new ApiError("VALIDATION_FAILED", "currency must be a 3-letter currency code", 422);
        const record = { organization_id: null, capability_code: capabilityCode, period, max_requests: maxRequests, max_tokens: maxTokens, max_cost_minor: maxCostMinor, currency, is_active: body.isActive === undefined ? true : Boolean(body.isActive) };
        let existingQuery = admin.from("ai_usage_limits").select("id").is("organization_id", null).eq("period", period);
        existingQuery = capabilityCode ? existingQuery.eq("capability_code", capabilityCode) : existingQuery.is("capability_code", null);
        const { data: existing } = await existingQuery.maybeSingle();
        const query = existing?.id ? admin.from("ai_usage_limits").update(record).eq("id", existing.id) : admin.from("ai_usage_limits").insert(record);
        const { data: saved, error } = await query.select().single();
        if (error) throw new ApiError("AI_LIMIT_UPDATE_FAILED", "Unable to save global AI usage limit", 500, undefined, false);
        await admin.from("platform_audit_log").insert({ actor_profile_id: auth.user.id, action: "ai.usage_limit_saved", target_type: "ai_usage_limit", target_id: saved.id, request_id: requestId, metadata: { capabilityCode, period, maxRequests, maxTokens, maxCostMinor, currency, isActive: saved.is_active } });
        return { data: saved };
      }

      throw new ApiError("VALIDATION_FAILED", "Unsupported platform AI action", 422);
    },
  ),
);
