import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { runAi } from "../_shared/ai/router.ts";
import { aiProvider } from "../_shared/ai/registry.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const allowed = new Set([
  "assistant.answer",
  "sermon.summarize",
  "translate.text",
  "content.moderate",
  "pastoral.triage",
  "admin.insight",
]);

const adapterMethod: Record<string, string> = {
  "assistant.answer": "generateText",
  "sermon.summarize": "generateStructuredData",
  "translate.text": "translateText",
  "content.moderate": "moderateContent",
  "pastoral.triage": "generateStructuredData",
  "admin.insight": "generateStructuredData",
};

async function requireActiveMembership(auth: any) {
  const { data, error } = await auth.client
    .from("memberships")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("profile_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new ApiError("MEMBERSHIP_LOOKUP_FAILED", "Unable to verify church membership", 500, undefined, false);
  if (!data) throw new ApiError("ACTIVE_MEMBERSHIP_REQUIRED", "Active church membership is required", 403);
}

async function readiness(organizationId: string, capability: string) {
  const admin = adminClient();

  const { data: tenantRoute, error: tenantRouteError } = await admin
    .from("ai_routes")
    .select("id,primary_model_id,fallback_model_ids,timeout_ms,max_retries")
    .eq("organization_id", organizationId)
    .eq("capability_code", capability)
    .eq("is_active", true)
    .maybeSingle();
  if (tenantRouteError) throw new ApiError("AI_READINESS_FAILED", "Unable to inspect AI route", 500, undefined, false);

  let route = tenantRoute;
  if (!route) {
    const { data: globalRoute, error: globalRouteError } = await admin
      .from("ai_routes")
      .select("id,primary_model_id,fallback_model_ids,timeout_ms,max_retries")
      .is("organization_id", null)
      .eq("capability_code", capability)
      .eq("is_active", true)
      .maybeSingle();
    if (globalRouteError) throw new ApiError("AI_READINESS_FAILED", "Unable to inspect AI route", 500, undefined, false);
    route = globalRoute;
  }

  if (!route) return { ready: false, reason: "route_not_configured" as const };

  const candidateIds = [route.primary_model_id, ...(route.fallback_model_ids ?? [])];
  const { data: models, error: modelsError } = await admin
    .from("ai_models")
    .select("id,model_key,display_name,is_active,provider_id,ai_providers!inner(code,name,status,secret_reference)")
    .in("id", candidateIds);
  if (modelsError) throw new ApiError("AI_READINESS_FAILED", "Unable to inspect AI models", 500, undefined, false);

  const modelMap = new Map((models ?? []).map((model: any) => [model.id, model]));
  for (const modelId of candidateIds) {
    const model: any = modelMap.get(modelId);
    if (!model?.is_active) continue;
    const provider = Array.isArray(model.ai_providers) ? model.ai_providers[0] : model.ai_providers;
    if (!provider || provider.status !== "active") continue;
    if (!provider.secret_reference || !Deno.env.get(provider.secret_reference)?.trim()) continue;
    try {
      const adapter = aiProvider(provider.code);
      if (!adapter.supports(adapterMethod[capability] as any)) continue;
    } catch {
      continue;
    }
    return {
      ready: true,
      reason: null,
      providerCode: provider.code,
      providerName: provider.name,
      modelKey: model.model_key,
      modelName: model.display_name,
    };
  }

  return { ready: false, reason: "provider_model_or_secret_unavailable" as const };
}

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);
    await requireActiveMembership(auth);

    if (request.method === "GET") {
      const url = new URL(request.url);
      const capability = url.searchParams.get("capability") ?? "assistant.answer";
      if (!allowed.has(capability)) throw new ApiError("AI_CAPABILITY_DENIED", "Capability is not available through this endpoint", 422);
      if (capability !== "assistant.answer") await authorize(auth, "ai.use");
      return { data: { capability, ...(await readiness(auth.organizationId, capability)) } };
    }

    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["capability", "prompt", "language", "entityType", "entityId"]);
    const capability = requiredString(body.capability, "capability", 60);
    if (!allowed.has(capability)) throw new ApiError("AI_CAPABILITY_DENIED", "Capability is not available through this endpoint", 422);

    if (capability !== "assistant.answer") {
      await authorize(auth, "ai.use");
    } else {
      const state = await readiness(auth.organizationId, capability);
      if (!state.ready) throw new ApiError("AI_ASSISTANT_NOT_READY", "The church assistant is not configured yet", 503, { reason: state.reason }, false);
    }

    const prompt = requiredString(body.prompt, "prompt", 12000);
    const entityType = optionalString(body.entityType, "entityType", 50);
    const entityId = body.entityId ? uuid(String(body.entityId), "entityId", true) : undefined;

    let verifiedContext = "";
    if (capability === "assistant.answer") {
      const [branches, events, announcements] = await Promise.all([
        auth.client.from("branches").select("name,timezone,address").eq("organization_id", auth.organizationId).eq("is_active", true).limit(30),
        auth.client.from("events").select("title,starts_at,ends_at,location,visibility").eq("organization_id", auth.organizationId).gte("ends_at", new Date().toISOString()).limit(30),
        auth.client.from("announcements").select("title,body,published_at").eq("organization_id", auth.organizationId).eq("status", "published").limit(20),
      ]);
      verifiedContext = JSON.stringify({ branches: branches.data ?? [], events: events.data ?? [], announcements: announcements.data ?? [] });
    }

    const system = `You are the church platform assistant. Use only verified tenant-scoped context. Never invent people, times, policies or pastoral claims. Never reveal private prayer, counselling, giving or attendance records. If uncertain, say so. Verified context: ${verifiedContext}`;
    const result = await runAi({
      organizationId: auth.organizationId,
      profileId: auth.user.id,
      capabilityCode: capability,
      request: {
        model: "resolved-by-route",
        system,
        prompt,
        language: optionalString(body.language, "language", 30),
        jsonSchema: capability === "pastoral.triage"
          ? {
              type: "object",
              properties: {
                category: { type: "string" },
                urgency: { type: "string" },
                suggestedWorkflow: { type: "string" },
                requiresHumanReview: { type: "boolean" },
              },
              required: ["category", "urgency", "requiresHumanReview"],
            }
          : undefined,
      },
      entityType,
      entityId,
    });
    return { data: result, status: result.status === "requires_review" ? 202 : 200 };
  },
));
