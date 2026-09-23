import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { runAi } from "../_shared/ai/router.ts";
import { aiProvider } from "../_shared/ai/registry.ts";
import { adminClient } from "../_shared/supabase.ts";
import { resolveSecretValue } from "../_shared/secrets.ts";
import { assertFeatureEnabled } from "../_shared/feature-controls.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";
import { formatCotGuideContext, type CotGuideAudience } from "../_shared/cot-guides.ts";

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
  return data;
}

const MINISTRY_GUIDE_PERMISSIONS = [
  "announcements.manage","events.create","events.update","attendance.read","attendance.manage","groups.manage","groups.members.manage",
  "prayer.moderate","prayer.pastoral.receive","prayer.team.receive","volunteers.manage","giving.campaigns.manage","giving.finance.read",
  "giving.refunds.manage","finance.read","finance.manage","streams.manage","streams.broadcast","streams.recordings.manage","sermons.create",
  "sermons.manage","sermons.publish","bible.manage","roles.read","roles.manage","roles.assign","members.read","members.update","members.invite",
  "organization.leadership.manage","branches.update","polls.manage","testimonies.review","testimonies.manage","units.manage","media.upload",
  "posts.publish","reels.create","videos.create","feed.post"
];

async function assistantGuideAccess(auth: any, membershipId: string) {
  const branchClause = auth.branchId ?? "00000000-0000-0000-0000-000000000000";
  const { data, error } = await auth.client
    .from("role_assignments")
    .select("branch_id,expires_at,role:roles(role_permissions(permission:permissions(code,is_active)))")
    .eq("membership_id", membershipId)
    .or(`branch_id.is.null,branch_id.eq.${branchClause}`);
  if (error) throw new ApiError("AI_GUIDE_ACCESS_FAILED", "Unable to resolve guide access", 500, undefined, false);
  const now = Date.now();
  const permissionCodes = [...new Set((data ?? [])
    .filter((assignment: any) => !assignment.expires_at || Date.parse(assignment.expires_at) > now)
    .flatMap((assignment: any) => {
      const role = Array.isArray(assignment.role) ? assignment.role[0] : assignment.role;
      return (role?.role_permissions ?? [])
        .filter((entry: any) => entry.permission?.is_active && entry.permission?.code)
        .map((entry: any) => String(entry.permission.code));
    }))].sort();
  const hasMinistryGuide = permissionCodes.some((code) => MINISTRY_GUIDE_PERMISSIONS.includes(code));
  const audiences: CotGuideAudience[] = hasMinistryGuide ? ["member", "ministry"] : ["member"];
  return { audiences, permissionCodes };
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

type MemberConcern = {
  supportSuggested: boolean;
  urgentSafety: boolean;
  category: "emotional_support" | "self_harm" | "harm_to_others" | "other";
};

function classifyMemberConcern(message: string): MemberConcern {
  const text = message.toLowerCase().replace(/\s+/g, " ").trim();
  const emotional = /\b(depress(?:ed|ion)?|hopeless|overwhelmed|lonely|grief|grieving|bereav(?:ed|ement)|anxious|anxiety|panic|heartbroken|worthless|empty|can'?t cope|cannot cope)\b/i.test(text);
  const selfHarm =
    /\b(?:i|i'm|im|myself|me)\b.{0,80}\b(?:kill myself|hurt myself|harm myself|end my life|take my life|want to die|suicid(?:e|al))\b/i.test(text) ||
    /\b(?:kill myself|hurt myself|harm myself|end my life|take my life|want to die|suicid(?:e|al))\b.{0,80}\b(?:i|i'm|im|myself|me)\b/i.test(text);
  const harmOther =
    /\b(?:i|i'm|im|me)\b.{0,80}\b(?:kill|hurt|harm|attack)\b.{0,40}\b(?:him|her|them|someone|somebody|people|person)\b/i.test(text);
  return {
    supportSuggested: emotional || selfHarm || harmOther,
    urgentSafety: selfHarm || harmOther,
    category: selfHarm ? "self_harm" : harmOther ? "harm_to_others" : emotional ? "emotional_support" : "other",
  };
}

async function createPastoralAlert(auth: any, input: {
  memberMessage: string;
  triggerType: "member_requested" | "urgent_safety";
  riskLevel: "routine" | "high";
  category: MemberConcern["category"];
  consentGiven: boolean;
}) {
  const admin = adminClient();
  const message = input.memberMessage.trim().slice(0, 3000);
  if (!message) throw new ApiError("VALIDATION_FAILED", "A message is required for pastoral care", 422);

  // Avoid duplicate alerts when a member retries the same urgent message.
  const recentCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  let duplicateQuery = admin
    .from("ai_pastoral_alerts")
    .select("id,created_at")
    .eq("organization_id", auth.organizationId)
    .eq("profile_id", auth.user.id)
    .eq("trigger_type", input.triggerType)
    .eq("member_message", message)
    .gte("created_at", recentCutoff)
    .order("created_at", { ascending: false })
    .limit(1);
  duplicateQuery = auth.branchId ? duplicateQuery.eq("branch_id", auth.branchId) : duplicateQuery.is("branch_id", null);
  const { data: duplicate } = await duplicateQuery.maybeSingle();
  if (duplicate?.id) return { id: duplicate.id, routed: true, duplicate: true };

  const { data: created, error } = await admin.from("ai_pastoral_alerts").insert({
    organization_id: auth.organizationId,
    branch_id: auth.branchId ?? null,
    profile_id: auth.user.id,
    trigger_type: input.triggerType,
    risk_level: input.riskLevel,
    category: input.category,
    member_message: message,
    consent_given: input.consentGiven,
  }).select("id").single();
  if (error || !created?.id) throw new ApiError("PASTORAL_ALERT_CREATE_FAILED", "Unable to send the pastoral care request", 500, undefined, false);

  const { data: recipientCount, error: routeError } = await admin.rpc("route_ai_pastoral_alert", { target_alert_id: created.id });
  if (routeError) throw new ApiError("PASTORAL_ALERT_ROUTE_FAILED", "The pastoral care request was saved but could not be routed yet", 500, undefined, false);
  return { id: created.id, routed: Number(recipientCount ?? 0) > 0, recipientCount: Number(recipientCount ?? 0), duplicate: false };
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
    const activeMembership = await requireActiveMembership(auth);

    if (request.method === "GET") {
      const url = new URL(request.url);
      const capability = url.searchParams.get("capability") ?? "assistant.answer";
      if (!allowed.has(capability)) throw new ApiError("AI_CAPABILITY_DENIED", "Capability is not available through this endpoint", 422);
      if (capability !== "assistant.answer") await authorize(auth, "ai.use");
      else await assertFeatureEnabled(adminClient(), "cot_assistant", { organizationId: auth.organizationId, expressionId: auth.branchId ?? null }, "COT Assistant is currently unavailable in this area.");
      return { data: { capability, ...(await readiness(auth.organizationId, capability)) } };
    }

    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["action", "capability", "prompt", "userMessage", "language", "entityType", "entityId"]);

    const action = optionalString(body.action, "action", 60);
    if (action === "request_pastoral_care") {
      await assertFeatureEnabled(adminClient(), "cot_assistant", { organizationId: auth.organizationId, expressionId: auth.branchId ?? null }, "COT Assistant is currently unavailable in this area.");
      const memberMessage = requiredString(body.userMessage, "userMessage", 3000);
      const concern = classifyMemberConcern(memberMessage);
      const alert = await createPastoralAlert(auth, {
        memberMessage,
        triggerType: "member_requested",
        riskLevel: "routine",
        category: concern.category === "other" ? "emotional_support" : concern.category,
        consentGiven: true,
      });
      return { data: { pastoralCare: { requested: true, alertId: alert.id, routed: alert.routed } } };
    }

    const capability = requiredString(body.capability, "capability", 60);
    if (!allowed.has(capability)) throw new ApiError("AI_CAPABILITY_DENIED", "Capability is not available through this endpoint", 422);

    if (capability !== "assistant.answer") await authorize(auth, "ai.use");
    else {
      await assertFeatureEnabled(adminClient(), "cot_assistant", { organizationId: auth.organizationId, expressionId: auth.branchId ?? null }, "COT Assistant is currently unavailable in this area.");
      const state = await readiness(auth.organizationId, capability);
      if (!state.ready) throw new ApiError("AI_ASSISTANT_NOT_READY", "The church assistant is not configured yet", 503, { reason: state.reason }, false);
    }

    const prompt = requiredString(body.prompt, "prompt", 12000);
    const memberMessage = capability === "assistant.answer"
      ? (optionalString(body.userMessage, "userMessage", 3000) ?? prompt.slice(0, 3000))
      : "";
    const memberConcern = capability === "assistant.answer" ? classifyMemberConcern(memberMessage) : { supportSuggested: false, urgentSafety: false, category: "other" as const };
    const urgentAlert = capability === "assistant.answer" && memberConcern.urgentSafety
      ? await createPastoralAlert(auth, {
          memberMessage,
          triggerType: "urgent_safety",
          riskLevel: "high",
          category: memberConcern.category,
          consentGiven: false,
        })
      : null;
    const entityType = optionalString(body.entityType, "entityType", 50);
    const entityId = body.entityId ? uuid(String(body.entityId), "entityId", true) : undefined;
    const verifiedContext = capability === "assistant.answer" ? await assistantContext(auth, entityType, entityId) : "";
    const guideAccess = capability === "assistant.answer" ? await assistantGuideAccess(auth, activeMembership.id) : { audiences: [] as CotGuideAudience[], permissionCodes: [] as string[] };
    const guideContext = capability === "assistant.answer"
      ? formatCotGuideContext({ audiences: guideAccess.audiences, query: prompt, permissionCodes: guideAccess.permissionCodes, limit: 8 })
      : "";
    const sermonRule = entityType === "sermon" ? " The verified context contains the exact saved sermon. Base the answer on that sermon, including its content_blocks/description/transcript, and never claim that only a fragment was supplied when the verified sermon contains more content." : "";
    const pastoralSafetyInstruction = memberConcern.urgentSafety
      ? "The member's latest message contains explicit first-person safety-risk language. A restricted pastoral safety alert has already been created for the exact current church/Expression scope. Respond with calm, compassionate language; encourage the member to stay with a trusted person and contact local emergency or crisis services if danger is immediate; include 1-3 relevant Scripture references without inventing verse wording; and clearly tell the member that COT AI sent a restricted alert to the assigned pastoral care team because the message suggested immediate safety risk."
      : memberConcern.supportSuggested
        ? "The member's latest message suggests emotional distress. Respond warmly and without judgment. Do not diagnose them or pretend to replace a counsellor, clinician, or pastor. Offer practical next steps, 1-3 relevant Scripture references without inventing verse wording, and encourage them to use the visible Request pastoral care action if they want the assigned pastoral team to contact them. Do not say that a report was sent because routine emotional-support conversations are not silently reported."
        : "";

    const system = `You are COT AI, the conversational assistant inside City of Transformation. Be natural and useful for ordinary everyday conversation. For church-specific facts, Quick Facts, schedules, leaders, locations, story, sermons, announcements, groups, posts, permissions and navigation, rely on the verified tenant-scoped context and never invent facts or routes. When a verified route exists, tell the member the exact destination in plain language; the app will render matching action buttons. When the person asks how COT works, how to use a screen, what a control does, or how to perform a member or ministry workflow, use the retrieved COT Guide context below as the operating authority. Give practical step-by-step instructions with the visible screen names and expected result. The guide audiences were resolved from the signed-in account. Never expose internal permission codes, and never imply that a ministry tool is available when the verified guide audience does not include ministry or the relevant guide section was filtered out. Keep the active General/Expression scope clear. Never reveal private prayer, counselling, giving, attendance, identity/KYC or private messaging records. Never reveal, reconstruct, guess, request, or claim access to passwords, API keys, private credentials, recovery codes, service-role keys, certificates, tokens, or administrator secrets. If asked for one, politely explain that protected credentials are private and not available through COT AI, and direct the person to the legitimate sign-in, password-reset, or authorised administrator process when known. Do not pretend to be a pastor or replace human pastoral care. If a church-specific fact is absent from verified context, say that it has not been published or configured yet rather than guessing. When providing emotional or spiritual support, use Scripture references that the app can preview rather than fabricating quotations. ${pastoralSafetyInstruction}${sermonRule} Verified context: ${verifiedContext}\n\nRetrieved COT Guide context:\n${guideContext || "No matching guide section was available for this account and question."}`;

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
    return {
      data: {
        ...result,
        pastoralCare: capability === "assistant.answer" ? {
          supportSuggested: memberConcern.supportSuggested,
          requestAvailable: memberConcern.supportSuggested && !memberConcern.urgentSafety,
          urgentAlertSent: Boolean(urgentAlert),
          alertRouted: urgentAlert?.routed ?? false,
          riskLevel: memberConcern.urgentSafety ? "high" : memberConcern.supportSuggested ? "support" : "none",
        } : undefined,
      },
      status: result.status === "requires_review" ? 202 : 200,
    };
  },
));