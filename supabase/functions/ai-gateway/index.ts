import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { runAi } from "../_shared/ai/router.ts";
import { aiProvider } from "../_shared/ai/registry.ts";
import { adminClient } from "../_shared/supabase.ts";
import { resolveSecretValue } from "../_shared/secrets.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const allowed = new Set(["assistant.answer", "sermon.summarize", "translate.text", "content.moderate", "pastoral.triage", "admin.insight"]);
const adapterMethod: Record<string, string> = {
  "assistant.answer": "generateText",
  "sermon.summarize": "generateStructuredData",
  "translate.text": "translateText",
  "content.moderate": "moderateContent",
  "pastoral.triage": "generateStructuredData",
  "admin.insight": "generateStructuredData",
};

async function requireActiveMembership(auth: any) {
  const { data, error } = await auth.client.from("memberships").select("id").eq("organization_id", auth.organizationId).eq("profile_id", auth.user.id).eq("status", "active").maybeSingle();
  if (error) throw new ApiError("MEMBERSHIP_LOOKUP_FAILED", "Unable to verify church membership", 500, undefined, false);
  if (!data) throw new ApiError("ACTIVE_MEMBERSHIP_REQUIRED", "Active church membership is required", 403);
}

async function readiness(organizationId: string, capability: string) {
  const admin = adminClient();
  const { data: tenantRoute, error: tenantRouteError } = await admin.from("ai_routes").select("id,primary_model_id,fallback_model_ids,timeout_ms,max_retries").eq("organization_id", organizationId).eq("capability_code", capability).eq("is_active", true).maybeSingle();
  if (tenantRouteError) throw new ApiError("AI_READINESS_FAILED", "Unable to inspect AI route", 500, undefined, false);
  let route = tenantRoute;
  if (!route) {
    const { data: globalRoute, error: globalRouteError } = await admin.from("ai_routes").select("id,primary_model_id,fallback_model_ids,timeout_ms,max_retries").is("organization_id", null).eq("capability_code", capability).eq("is_active", true).maybeSingle();
    if (globalRouteError) throw new ApiError("AI_READINESS_FAILED", "Unable to inspect AI models", 500, undefined, false);
    route = globalRoute;
  }
  if (!route) return { ready: false, reason: "route_not_configured" as const };

  const candidateIds = [route.primary_model_id, ...(route.fallback_model_ids ?? [])];
  const { data: models, error: modelsError } = await admin.from("ai_models").select("id,model_key,display_name,is_active,provider_id,ai_providers!inner(code,name,status,secret_reference)").in("id", candidateIds);
  if (modelsError) throw new ApiError("AI_READINESS_FAILED", "Unable to inspect AI models", 500, undefined, false);
  const modelMap = new Map((models ?? []).map((model: any) => [model.id, model]));
  for (const modelId of candidateIds) {
    const model: any = modelMap.get(modelId);
    if (!model?.is_active) continue;
    const provider = Array.isArray(model.ai_providers) ? model.ai_providers[0] : model.ai_providers;
    if (!provider || provider.status !== "active" || !provider.secret_reference) continue;
    try {
      await resolveSecretValue(provider.secret_reference);
      if (!aiProvider(provider.code).supports(adapterMethod[capability] as any)) continue;
    } catch { continue; }
    return { ready: true, reason: null, providerCode: provider.code, providerName: provider.name, modelKey: model.model_key, modelName: model.display_name };
  }
  return { ready: false, reason: "provider_model_or_secret_unavailable" as const };
}

function appRoutes(branchId: string | null) {
  const expressionBase = branchId ? `/expressions/${branchId}` : null;
  return {
    currentScope: branchId ? "expression" : "general",
    generalHome: "/general",
    expressions: "/expressions",
    messages: "/general/chat",
    notifications: expressionBase ? `${expressionBase}/notifications` : "/general/notifications",
    generalPrayer: "/general/prayer",
    prayer: expressionBase ? `${expressionBase}/prayer` : "/general/prayer",
    generalEvents: "/general/events",
    events: expressionBase ? `${expressionBase}/events` : "/general/events",
    generalSermons: "/general/sermons",
    sermons: expressionBase ? `${expressionBase}/sermons` : "/general/sermons",
    generalGiving: "/general/giving",
    giving: expressionBase ? `${expressionBase}/giving` : "/general/giving",
    groups: expressionBase ? `${expressionBase}/groups` : "/expressions",
    story: "/general/church-story",
    expressionHome: expressionBase,
  };
}

function compactText(value: unknown, maximum = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : value;
}

function publicLocation(settings: unknown) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const value = (settings as Record<string, unknown>).public_location;
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

async function assistantContext(auth: any, entityType?: string, entityId?: string) {
  if (entityType === "sermon" && entityId) {
    // Read the exact requested sermon through the caller-scoped client so RLS
    // remains authoritative for private Expression sermon access.
    const { data: sermon, error } = await auth.client
      .from("sermons")
      .select("id,organization_id,expression_id,title,preacher,description,transcript,content_blocks,scripture_references,topics,status,published_at")
      .eq("organization_id", auth.organizationId)
      .eq("id", entityId)
      .maybeSingle();
    if (error) throw new ApiError("AI_SERMON_CONTEXT_FAILED", "Unable to load this sermon for the study helper", 500, undefined, false);
    if (!sermon) throw new ApiError("AI_SERMON_NOT_FOUND", "This sermon is not available in your current church or Expression", 404);
    return JSON.stringify({ focus: "sermon", scope: auth.branchId ? "expression" : "general", routes: appRoutes(auth.branchId), sermon });
  }

  // COT AI gets a broad, curated knowledge view rather than raw database access.
  // Only non-sensitive church facts are read with the admin client, and every
  // query is tenant-scoped. Prayer, counselling, giving, attendance, private DMs,
  // KYC and other sensitive member records are deliberately excluded.
  const admin = adminClient();
  const profilePromise = auth.client.from("profiles").select("id,display_name,username").eq("id", auth.user.id).maybeSingle();
  const organizationPromise = admin.from("organizations").select("id,name,slug,timezone,settings").eq("id", auth.organizationId).eq("status", "active").maybeSingle();
  const currentExpressionPromise = auth.branchId
    ? admin.from("branches").select("id,name,code,timezone,address").eq("organization_id", auth.organizationId).eq("id", auth.branchId).eq("is_active", true).maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const branchesPromise = admin.from("branches").select("id,name,code,timezone,address").eq("organization_id", auth.organizationId).eq("is_active", true).order("name").limit(50);
  const storyPromise = admin.from("church_story")
    .select("title,subtitle,mission,vision,founding_story,founding_year,history_milestones,quick_facts,values,updated_at")
    .eq("organization_id", auth.organizationId).eq("is_published", true).maybeSingle();

  let leadershipQuery = admin.from("leadership_profiles")
    .select("id,expression_id,display_name,role_title,short_bio,ministry,is_founder,is_featured_public")
    .eq("organization_id", auth.organizationId).eq("is_active", true).order("display_order", { ascending: true }).limit(100);
  leadershipQuery = auth.branchId
    ? leadershipQuery.or(`expression_id.is.null,expression_id.eq.${auth.branchId}`)
    : leadershipQuery.is("expression_id", null);

  let sermonsQuery = admin.from("sermons")
    .select("id,expression_id,title,preacher,sermon_date,scripture_references,topics,description,published_at")
    .eq("organization_id", auth.organizationId).eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false }).limit(24);
  sermonsQuery = auth.branchId
    ? sermonsQuery.or(`expression_id.is.null,expression_id.eq.${auth.branchId}`)
    : sermonsQuery.is("expression_id", null);

  let eventsQuery = admin.from("events")
    .select("id,branch_id,title,description,starts_at,ends_at,location,visibility")
    .eq("organization_id", auth.organizationId).eq("status", "published").gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true }).limit(30);
  let announcementQuery = admin.from("announcements")
    .select("id,branch_id,title,body,published_at")
    .eq("organization_id", auth.organizationId).eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false }).limit(24);
  let postsQuery = admin.from("social_posts")
    .select("id,branch_id,visibility,body,published_at")
    .eq("organization_id", auth.organizationId).eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false }).limit(20);
  let groupsQuery = admin.from("groups")
    .select("id,branch_id,name,description,visibility,meeting_schedule,join_policy")
    .eq("organization_id", auth.organizationId).eq("is_active", true).order("name").limit(40);

  if (auth.branchId) {
    eventsQuery = eventsQuery.or(`branch_id.is.null,branch_id.eq.${auth.branchId}`);
    announcementQuery = announcementQuery.or(`branch_id.is.null,branch_id.eq.${auth.branchId}`);
    postsQuery = postsQuery.or(`branch_id.is.null,branch_id.eq.${auth.branchId}`);
    groupsQuery = groupsQuery.eq("branch_id", auth.branchId);
  } else {
    eventsQuery = eventsQuery.is("branch_id", null);
    announcementQuery = announcementQuery.is("branch_id", null);
    postsQuery = postsQuery.is("branch_id", null).eq("visibility", "public");
    groupsQuery = groupsQuery.is("branch_id", null);
  }

  const [profile, organization, currentExpression, branches, story, leadership, sermons, events, announcements, posts, groups] = await Promise.all([
    profilePromise,
    organizationPromise,
    currentExpressionPromise,
    branchesPromise,
    storyPromise,
    leadershipQuery,
    sermonsQuery,
    eventsQuery,
    announcementQuery,
    postsQuery,
    groupsQuery,
  ]);

  const org = organization.error ? null : organization.data;
  const safeStory = story.error || !story.data ? null : {
    ...story.data,
    mission: compactText(story.data.mission),
    vision: compactText(story.data.vision),
    founding_story: compactText(story.data.founding_story, 6000),
  };
  const safeLeaders = leadership.error ? [] : (leadership.data ?? []).map((leader: any) => ({
    ...leader,
    short_bio: compactText(leader.short_bio, 1200),
  }));
  const safeSermons = sermons.error ? [] : (sermons.data ?? []).map((sermon: any) => ({
    ...sermon,
    description: compactText(sermon.description, 1600),
  }));
  const safePosts = posts.error ? [] : (posts.data ?? []).map((post: any) => ({ ...post, body: compactText(post.body, 1000) }));
  const branchRows = branches.error ? [] : branches.data ?? [];

  return JSON.stringify({
    focus: "church",
    scope: auth.branchId ? "expression" : "general",
    member: profile.data ? { displayName: profile.data.display_name, username: profile.data.username } : null,
    church: org ? { id: org.id, name: org.name, slug: org.slug, timezone: org.timezone, location: publicLocation(org.settings) } : null,
    churchStory: safeStory,
    currentExpression: currentExpression.error ? null : currentExpression.data ?? null,
    routes: appRoutes(auth.branchId),
    availableExpressions: branchRows.map((branch: any) => ({ id: branch.id, name: branch.name, code: branch.code, timezone: branch.timezone, address: branch.address })),
    leaders: safeLeaders,
    sermons: safeSermons,
    events: events.error ? [] : events.data ?? [],
    announcements: announcements.error ? [] : announcements.data ?? [],
    recentCommunityPosts: safePosts,
    groups: groups.error ? [] : groups.data ?? [],
    guidance: {
      privacy: "Use only this curated verified context for church facts. Never reveal or claim access to private prayer, counselling, giving, attendance, identity/KYC, private messaging, or other sensitive member records.",
      locations: "Church and Expression locations are authoritative only when a non-empty saved location/address is present. If an address object is empty or absent, say that no address has been published yet. Never invent a street, building, landmark, coordinate, or map location.",
      leaders: "The leaders array is the current authoritative leadership directory visible for this scope. Prefer display_name, role_title, ministry and short_bio from it instead of guessing from memory.",
      prayer: auth.branchId
        ? "When a member asks how to send prayer, direct them to routes.prayer for the active Expression and mention routes.generalPrayer as the church-wide alternative."
        : "When a member asks how to send prayer, direct them to routes.generalPrayer. If they specifically want an Expression prayer request, direct them to routes.expressions first.",
      navigation: "When the member asks where or how to do something in COT, name the exact verified destination from routes. Never invent a route.",
      formatting: "You may use Markdown for useful headings, bold emphasis, italic emphasis and lists. The COT app renders this formatting. Do not expose implementation syntax as an explanation.",
    },
  });
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

    if (capability !== "assistant.answer") await authorize(auth, "ai.use");
    else {
      const state = await readiness(auth.organizationId, capability);
      if (!state.ready) throw new ApiError("AI_ASSISTANT_NOT_READY", "The church assistant is not configured yet", 503, { reason: state.reason }, false);
    }

    const prompt = requiredString(body.prompt, "prompt", 12000);
    const entityType = optionalString(body.entityType, "entityType", 50);
    const entityId = body.entityId ? uuid(String(body.entityId), "entityId", true) : undefined;
    const verifiedContext = capability === "assistant.answer" ? await assistantContext(auth, entityType, entityId) : "";
    const sermonRule = entityType === "sermon" ? " The verified context contains the exact saved sermon. Base the answer on that sermon, including its content_blocks/description/transcript, and never claim that only a fragment was supplied when the verified sermon contains more content." : "";
    const system = `You are COT AI, the conversational assistant inside City of Transformation. Be natural and useful for ordinary everyday conversation. For church-specific facts, Quick Facts, schedules, leaders, locations, story, sermons, announcements, groups, posts, permissions and navigation, rely on the verified tenant-scoped context and never invent facts or routes. When a verified route exists, tell the member the exact destination in plain language; the app will render matching action buttons. Keep the active General/Expression scope clear. Never reveal private prayer, counselling, giving, attendance, identity/KYC or private messaging records. Do not pretend to be a pastor or replace human pastoral care. If a church-specific fact is absent from verified context, say that it has not been published or configured yet rather than guessing.${sermonRule} Verified context: ${verifiedContext}`;

    const result = await runAi({
      organizationId: auth.organizationId,
      profileId: auth.user.id,
      capabilityCode: capability,
      request: {
        model: "resolved-by-route",
        system,
        prompt,
        language: optionalString(body.language, "language", 30),
        jsonSchema: capability === "pastoral.triage" ? {
          type: "object",
          properties: { category: { type: "string" }, urgency: { type: "string" }, suggestedWorkflow: { type: "string" }, requiresHumanReview: { type: "boolean" } },
          required: ["category", "urgency", "requiresHumanReview"],
        } : undefined,
      },
      entityType,
      entityId,
    });
    return { data: result, status: result.status === "requires_review" ? 202 : 200 };
  },
));