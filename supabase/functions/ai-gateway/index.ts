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
import { formatCotLifeGuidance } from "../_shared/cot-life-guidance.ts";

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
    pastoralCare: branchId ? `${expressionBase}/manage/prayer` : "/general/leadership/pastoral-triage",
  };
}

function compactText(value: unknown, maximum = 4000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : value;
}

type CareCategory = "emotional_distress" | "self_harm_risk" | "harm_to_others_risk" | "abuse_or_immediate_safety" | "grief_or_loss" | "other";
type CareSeverity = "support" | "elevated" | "urgent";
type CareAssessment = {
  category: CareCategory;
  severity: CareSeverity;
  offerPastoralSupport: boolean;
  autoEscalate: boolean;
  requiresImmediateAttention: boolean;
  summary: string;
  memberNotice: string;
};

function extractCurrentMemberMessage(prompt: string) {
  const match = prompt.match(/Current member message:\s*([\s\S]*?)(?:\n\n|$)/i);
  return (match?.[1] ?? prompt).trim().slice(0, 2000);
}

function memberConversationExcerpt(prompt: string) {
  const userLines = [...prompt.matchAll(/^Member:\s*(.+)$/gmi)].map((match) => match[1].trim()).filter(Boolean);
  const current = extractCurrentMemberMessage(prompt);
  if (current && !userLines.some((item) => item === current)) userLines.push(current);
  return userLines.join("\n").slice(-6000);
}

function assistantBoundaryReply(prompt: string) {
  const current = extractCurrentMemberMessage(prompt).toLowerCase();
  const asksAboutLimits = [
    /\bwhat (?:are|is) your limits?\b/,
    /\bwhat can you access\b/,
    /\bwhat can(?:'t|not) you access\b/,
    /\bwhat information (?:can|do) you (?:see|know|access)\b/,
    /\bwhat do you know about me\b/,
    /\bcan you see my (?:private )?(?:messages|password|credentials|data)\b/,
    /\bhow private is (?:this|cot ai)\b/,
  ].some((pattern) => pattern.test(current));
  if (!asksAboutLimits) return null;

  return [
    "Here are my main limits inside COT:",
    "",
    "- I can use this COT AI conversation, verified church information, the COT App Guide, and approved church content available to your current General or Expression context.",
    "- I do not have access to passwords, Platform Administration credentials, API keys, tokens, private invitation codes, private direct messages, confidential prayer or counselling records, giving details, attendance records, or other protected member data.",
    "- I cannot reveal or guess secrets, bypass permissions, or grant you access that your account does not have.",
    "- I can offer Bible-grounded encouragement and practical support, but I am not a pastor, doctor, therapist, lawyer, financial adviser, or emergency service.",
    "- For ordinary emotional distress, I can offer an optional confidential pastoral-support request. If a message clearly indicates immediate danger, self-harm, suicide risk, serious harm to another person, or abuse/immediate danger, COT AI may create a confidential safety alert for authorised pastoral-care roles in that exact church space, and I will tell you when that happens.",
    "- If a church-specific fact is not in verified COT information, I should say I do not know rather than invent it.",
  ].join("\n");
}

function christCenteredFaithRule(prompt: string) {
  const current = extractCurrentMemberMessage(prompt).toLowerCase();
  const comparativeFaithQuestion = /\b(?:islam|muslim|allah|qur['’]?an|koran|muhammad|mohammed|christianity|christian faith|other religions?|same god|same faith|abrahamic)\b/.test(current);
  if (!comparativeFaithQuestion) return "";

  return [
    "The member is asking about Christianity in relation to Islam or another faith.",
    "COT AI is a Christian discipleship assistant. Answer from historic Trinitarian Christian faith and keep Jesus Christ at the center.",
    "Describe another religion only as much as the question requires unless the member explicitly asks for a deeper comparison. Be factual, calm and respectful toward its adherents.",
    "Do not imply that shared ethics, monotheism, Abrahamic history, similar moral teachings, or common figures mean the religions have the same doctrine, gospel, salvation, or faith.",
    "For Christianity, anchor the answer in the Triune God, the divine Sonship and lordship of Jesus Christ, his incarnation, crucifixion and resurrection, and salvation through Christ.",
    "When Islam is part of the comparison, distinguish its teachings from Christian confession without attacking Muslims or using contemptuous language.",
    "If the member asks whether Christians and Muslims serve or worship the same God, do not reduce the answer to a slogan. Explain that COT does not treat the faiths as theologically interchangeable because Christian faith identifies God through the Father, the Son and the Holy Spirit and is centered on Jesus Christ. Briefly acknowledge shared monotheistic or Abrahamic language only as context, then return the member to Christ and Scripture.",
    "Where a church-specific doctrinal statement has not been published in verified COT context, identify the answer as the historic Christian/COT discipleship frame rather than inventing a denominational policy."
  ].join(" ");
}

function protectedCredentialReply(prompt: string) {
  const current = extractCurrentMemberMessage(prompt);
  const text = current.toLowerCase();
  const asksForSecret =
    /\b(?:what(?:'s| is)|tell me|give me|show me|send me|reveal|find|retrieve|get)\b[\s\S]{0,80}\b(?:password|passcode|api key|secret key|access token|refresh token|admin credential|administrator credential|private key|service role key)\b/.test(text) ||
    /\b(?:platform admin|platform administrator|supabase|vercel|netlify|api)\b[\s\S]{0,60}\b(?:password|credential|key|token|secret)\b/.test(text);
  const legitimateHelp = /\b(?:reset|forgot|change|recover|create|set|sign in|login|log in|invitation|invite|access request)\b/.test(text);
  if (!asksForSecret || legitimateHelp) return null;
  return [
    "I can’t provide or retrieve passwords, Platform Administration credentials, API keys, tokens, private keys, or other protected secrets.",
    "",
    "Those credentials are private and are not part of COT AI’s accessible knowledge. If you need legitimate access, use the official sign-in or password-reset process, or ask an authorised Platform Super Admin to invite or assist you.",
    "",
    "I can still explain how the authorised access process works without exposing any secret."
  ].join("\n");
}

function assessPastoralNeed(prompt: string): CareAssessment | null {
  const current = extractCurrentMemberMessage(prompt);
  const history = memberConversationExcerpt(prompt);
  const text = (history || current).toLowerCase();

  const selfHarm = [
    /\bkill myself\b/, /\bend my life\b/, /\btake my own life\b/, /\bhurt myself\b/,
    /\bself[- ]harm\b/, /\bi(?:'m| am) suicidal\b/, /\bi want to die\b/,
    /\bi (?:do not|don't) want to live\b/, /\bno reason to live\b/,
  ].some((pattern) => pattern.test(text));
  if (selfHarm) {
    return {
      category: "self_harm_risk",
      severity: "urgent",
      offerPastoralSupport: true,
      autoEscalate: true,
      requiresImmediateAttention: true,
      summary: "COT AI detected language indicating possible immediate self-harm or suicide risk. Please review this confidential alert and contact the member promptly.",
      memberNotice: "Because your message may indicate an immediate safety risk, COT AI has confidentially alerted the authorised pastoral care team for your current church space. Pastoral support is additional to emergency or professional help.",
    };
  }

  const harmToOthers = [
    /\bi(?:'m| am)? going to (?:kill|hurt|harm) (?:someone|him|her|them|people)\b/,
    /\bi want to (?:kill|hurt|harm) (?:someone|him|her|them|people)\b/,
    /\bi might (?:kill|hurt|harm) (?:someone|him|her|them|people)\b/,
  ].some((pattern) => pattern.test(text));
  if (harmToOthers) {
    return {
      category: "harm_to_others_risk",
      severity: "urgent",
      offerPastoralSupport: true,
      autoEscalate: true,
      requiresImmediateAttention: true,
      summary: "COT AI detected language indicating a possible immediate risk of harm to another person. Please review this confidential alert promptly.",
      memberNotice: "Because your message may indicate an immediate safety risk, COT AI has confidentially alerted the authorised pastoral care team for your current church space. Please also seek immediate local emergency help if anyone may be in danger.",
    };
  }

  const immediateSafety = [
    /\bi(?:'m| am) not safe\b/, /\bsomeone (?:is )?(?:hurting|beating|threatening) me\b/,
    /\bi(?:'m| am) being abused\b/, /\bdomestic violence\b/, /\bsexual assault\b/,
    /\bsomeone (?:is )?going to kill me\b/,
  ].some((pattern) => pattern.test(text));
  if (immediateSafety) {
    return {
      category: "abuse_or_immediate_safety",
      severity: "urgent",
      offerPastoralSupport: true,
      autoEscalate: true,
      requiresImmediateAttention: true,
      summary: "COT AI detected language indicating possible abuse or immediate personal danger. Please review this confidential alert and contact the member promptly.",
      memberNotice: "Because your message may indicate immediate danger, COT AI has confidentially alerted the authorised pastoral care team for your current church space. If you are in immediate danger, contact local emergency services or a trusted person who can reach you now.",
    };
  }

  const severeDistress = [
    /\bi (?:can't|cannot) go on\b/, /\bi(?:'m| am) hopeless\b/, /\bnothing matters anymore\b/,
    /\bi(?:'m| am) breaking down\b/, /\bi(?:'m| am) in crisis\b/,
  ].some((pattern) => pattern.test(text));
  if (severeDistress) {
    return {
      category: "emotional_distress",
      severity: "elevated",
      offerPastoralSupport: true,
      autoEscalate: false,
      requiresImmediateAttention: false,
      summary: "The member described significant emotional distress and requested or may benefit from confidential pastoral support.",
      memberNotice: "If you want, you can ask COT AI to send a confidential pastoral support request to the authorised care team in this church space.",
    };
  }

  const grief = /\b(grieving|grief|bereaved|bereavement|lost (?:my|someone)|death of my|died)\b/.test(text);
  if (grief) {
    return {
      category: "grief_or_loss",
      severity: "support",
      offerPastoralSupport: true,
      autoEscalate: false,
      requiresImmediateAttention: false,
      summary: "The member is dealing with grief or loss and may appreciate confidential pastoral support.",
      memberNotice: "If you want, you can ask COT AI to send a confidential pastoral support request to the authorised care team in this church space.",
    };
  }

  const explicitCareNeed = /\b(i need someone to talk to|i need to talk to someone|can i talk to (?:a )?pastor|i need (?:a )?pastor|pastoral care|i need counselling|i need counseling|i need help emotionally|please get me help)\b/.test(text);
  if (explicitCareNeed) {
    return {
      category: "other",
      severity: "support",
      offerPastoralSupport: true,
      autoEscalate: false,
      requiresImmediateAttention: false,
      summary: "The member directly expressed a need for someone to talk to or for confidential pastoral support.",
      memberNotice: "You can send a confidential pastoral support request to the authorised care team in this church space.",
    };
  }

  const emotionalDistress = /\b(i(?:'m| am) depressed|depression|i feel depressed|i(?:'m| am) overwhelmed|i feel hopeless|i(?:'m| am) anxious|panic attacks?|i feel lonely|i(?:'m| am) very sad|i can(?:'t|not) cope)\b/.test(text);
  if (emotionalDistress) {
    return {
      category: "emotional_distress",
      severity: "support",
      offerPastoralSupport: true,
      autoEscalate: false,
      requiresImmediateAttention: false,
      summary: "The member described emotional distress and may appreciate confidential pastoral support.",
      memberNotice: "If you want, you can ask COT AI to send a confidential pastoral support request to the authorised care team in this church space.",
    };
  }

  return null;
}

async function createPastoralAlert(
  auth: any,
  assessment: CareAssessment,
  prompt: string,
  sourceMode: "member_requested" | "automatic_safety",
) {
  const admin = adminClient();
  const excerpt = memberConversationExcerpt(prompt);
  const lastMemberMessage = extractCurrentMemberMessage(prompt);
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  let existingQuery = admin
    .from("ai_pastoral_alerts")
    .select("id,status,severity")
    .eq("organization_id", auth.organizationId)
    .eq("profile_id", auth.user.id)
    .eq("category", assessment.category)
    .in("status", ["new", "contacted"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  existingQuery = auth.branchId
    ? existingQuery.eq("branch_id", auth.branchId)
    : existingQuery.is("branch_id", null);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw new ApiError("AI_PASTORAL_ALERT_FAILED", "Unable to prepare pastoral support", 500, undefined, false);

  if (existing?.id) {
    const { error } = await admin
      .from("ai_pastoral_alerts")
      .update({
        severity: assessment.severity,
        summary: assessment.summary,
        conversation_excerpt: excerpt,
        last_member_message: lastMemberMessage,
        requires_immediate_attention: assessment.requiresImmediateAttention,
        member_notified: true,
      })
      .eq("id", existing.id);
    if (error) throw new ApiError("AI_PASTORAL_ALERT_FAILED", "Unable to update pastoral support", 500, undefined, false);
    const { data: recipientCountData } = await admin.rpc("ai_pastoral_recipient_count", {
      target_organization_id: auth.organizationId,
      target_branch_id: auth.branchId ?? null,
    });
    return { id: existing.id, created: false, recipientCount: Number(recipientCountData ?? 0) };
  }

  const { data, error } = await admin
    .from("ai_pastoral_alerts")
    .insert({
      organization_id: auth.organizationId,
      branch_id: auth.branchId ?? null,
      profile_id: auth.user.id,
      category: assessment.category,
      severity: assessment.severity,
      source_mode: sourceMode,
      summary: assessment.summary,
      conversation_excerpt: excerpt,
      last_member_message: lastMemberMessage,
      requires_immediate_attention: assessment.requiresImmediateAttention,
      member_notified: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new ApiError("AI_PASTORAL_ALERT_FAILED", "Unable to send pastoral support", 500, undefined, false);
  const { data: recipientCountData } = await admin.rpc("ai_pastoral_recipient_count", {
    target_organization_id: auth.organizationId,
    target_branch_id: auth.branchId ?? null,
  });
  return { id: data.id, created: true, recipientCount: Number(recipientCountData ?? 0) };
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
      lifeSupport: "COT AI may offer compassionate Bible-grounded encouragement for grief, loneliness, anxiety, depression, conflict, spiritual struggle, relationships and difficult decisions. It must not diagnose a mental or physical condition, replace a qualified clinician, lawyer, financial professional, emergency service, or human pastoral care, or present itself as a pastor.",
      secrets: "Passwords, administrator credentials, API keys, tokens, secret references, private invitation codes, private messages, confidential pastoral records and other protected information are outside the assistant's public knowledge. Never reveal, infer, fabricate or help bypass them. Explain the boundary politely and direct the person to the legitimate account or ministry process.",
      safety: "If someone may be in immediate danger, suicidal, self-harming, or threatening serious harm, prioritize immediate safety, encourage contacting local emergency services and a trusted person who can physically reach them, and make clear that pastoral care is additional support rather than a replacement for emergency or professional help.",
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
    assertNoUnknownFields(body, ["action", "capability", "prompt", "language", "entityType", "entityId", "careContext"]);
    const action = optionalString(body.action, "action", 50);
    if (action === "request_pastoral_support") {
      await assertFeatureEnabled(adminClient(), "pastoral_care", { organizationId: auth.organizationId, expressionId: auth.branchId ?? null }, "Pastoral care is currently unavailable in this area.");
      const careContext = optionalString(body.careContext, "careContext", 6000) ?? optionalString(body.prompt, "prompt", 12000) ?? "Member requested pastoral support through COT AI.";
      const detected = assessPastoralNeed(careContext);
      const assessment: CareAssessment = detected ?? {
        category: "other",
        severity: "support",
        offerPastoralSupport: true,
        autoEscalate: false,
        requiresImmediateAttention: false,
        summary: "The member requested confidential pastoral support through COT AI.",
        memberNotice: "Your confidential pastoral support request has been sent to the authorised care team in this church space.",
      };
      const alert = await createPastoralAlert(auth, assessment, careContext, "member_requested");
      const notice = alert.recipientCount > 0
        ? "Your confidential pastoral support request has been recorded and the authorised care team in this church space has been notified."
        : "Your confidential pastoral support request has been recorded, but no pastoral care recipient is currently assigned to this exact church space. Please also contact a trusted church leader directly if you need support.";
      return { data: { care: { alertId: alert.id, alertCreated: true, severity: assessment.severity, recipientCount: alert.recipientCount, notice } } };
    }
    if (action) throw new ApiError("VALIDATION_FAILED", "Unsupported COT AI action", 422);

    const capability = requiredString(body.capability, "capability", 60);
    if (!allowed.has(capability)) throw new ApiError("AI_CAPABILITY_DENIED", "Capability is not available through this endpoint", 422);

    if (capability !== "assistant.answer") await authorize(auth, "ai.use");
    else {
      await assertFeatureEnabled(adminClient(), "cot_assistant", { organizationId: auth.organizationId, expressionId: auth.branchId ?? null }, "COT Assistant is currently unavailable in this area.");
      const state = await readiness(auth.organizationId, capability);
      if (!state.ready) throw new ApiError("AI_ASSISTANT_NOT_READY", "The church assistant is not configured yet", 503, { reason: state.reason }, false);
    }

    const prompt = requiredString(body.prompt, "prompt", 12000);
    if (capability === "assistant.answer") {
      const protectedReply = protectedCredentialReply(prompt);
      if (protectedReply) {
        return {
          data: {
            status: "succeeded",
            content: protectedReply,
            guardrail: "protected_information",
          },
          status: 200,
        };
      }
      const boundaryReply = assistantBoundaryReply(prompt);
      if (boundaryReply) {
        return {
          data: {
            status: "succeeded",
            content: boundaryReply,
            guardrail: "assistant_boundaries",
          },
          status: 200,
        };
      }
    }
    const entityType = optionalString(body.entityType, "entityType", 50);
    const entityId = body.entityId ? uuid(String(body.entityId), "entityId", true) : undefined;
    const verifiedContext = capability === "assistant.answer" ? await assistantContext(auth, entityType, entityId) : "";
    const guideAccess = capability === "assistant.answer" ? await assistantGuideAccess(auth, activeMembership.id) : { audiences: [] as CotGuideAudience[], permissionCodes: [] as string[] };
    const guideContext = capability === "assistant.answer"
      ? formatCotGuideContext({ audiences: guideAccess.audiences, query: prompt, permissionCodes: guideAccess.permissionCodes, limit: 8 })
      : "";
    const lifeGuidance = capability === "assistant.answer" ? formatCotLifeGuidance(prompt, 3) : "";
    const faithFormationRule = capability === "assistant.answer" ? christCenteredFaithRule(prompt) : "";
    const sermonRule = entityType === "sermon" ? " The verified context contains the exact saved sermon. Base the answer on that sermon, including its content_blocks/description/transcript, and never claim that only a fragment was supplied when the verified sermon contains more content." : "";
    const careAssessment = capability === "assistant.answer" ? assessPastoralNeed(prompt) : null;
    const lifeCareRule = careAssessment
      ? ` The member's words may reflect ${careAssessment.category.replaceAll("_", " ")} at ${careAssessment.severity} level. Respond with warmth and dignity; do not diagnose. Start with the person's immediate concern rather than a generic disclaimer. Offer simple practical next steps and 1-3 relevant Scripture references so the app can render Bible previews. Prefer naming references (for example Psalm 34:18, Psalm 46:1, Matthew 11:28, Philippians 4:6-7) rather than reproducing long verse text. Encourage human connection and pastoral care. ${careAssessment.requiresImmediateAttention ? "Treat this as a safety-first response: encourage the person to contact local emergency services and a trusted person who can physically reach them now; if possible, encourage them not to stay alone and to move away from anything they could use to hurt themselves or someone else. Never rely on Scripture or pastoral care alone for an immediate safety emergency." : "Pastoral care is optional support; do not imply that ordinary distress has already been reported."}`
      : "";
    const system = `You are COT AI, the conversational assistant inside City of Transformation. You serve a Christian church and Christian discipleship: Jesus Christ is the center of spiritual formation and Scripture is the primary authority for Christian teaching. Do not flatten Christianity into generic spirituality or present distinct religions as interchangeable. Speak about people of other faiths with dignity and accuracy. Be natural, compassionate and useful for ordinary life conversation as well as church guidance. You may help with grief, loneliness, anxiety, depression, relationships, conflict, spiritual questions, difficult decisions and everyday struggles using practical wisdom and Bible-grounded encouragement, while staying within your limits. Never diagnose mental or physical illness, prescribe treatment, or present yourself as a therapist, doctor, lawyer, financial professional or pastor. For high-stakes health, legal, financial or safety matters, encourage appropriate qualified human help. For church-specific facts, Quick Facts, schedules, leaders, locations, story, sermons, announcements, groups, posts, permissions and navigation, rely on the verified tenant-scoped context and never invent facts or routes. When a verified route exists, tell the member the exact destination in plain language; the app will render matching action buttons. When the person asks how the COT App works, how to use a screen, what a control does, or how to perform a member or ministry workflow, use the retrieved COT App Guide context below as the operating authority. Give practical step-by-step instructions with the visible screen names and expected result. The guide audiences were resolved from the signed-in account. Never expose internal permission codes. Never reveal, infer, fabricate or help obtain passwords, Platform Administration credentials, API keys, tokens, secret references, private invitation codes, confidential pastoral records, identity/KYC data, private messages or other protected information. If asked for a password or secret, politely explain that it is private and unavailable to COT AI and point to the legitimate sign-in, reset, invitation or authorised administrator process. Keep the active General/Expression scope clear. Do not pretend to be a pastor or replace human pastoral care. If a church-specific fact is absent from verified context, say that it has not been published or configured yet rather than guessing.${lifeCareRule}${faithFormationRule ? ` ${faithFormationRule}` : ""}${sermonRule} Verified context: ${verifiedContext}\n\nRetrieved COT App Guide context:\n${guideContext || "No matching guide section was available for this account and question."}\n\nCurated life-and-Scripture guidance:\n${lifeGuidance || "No special life-guidance topic matched this question. Use ordinary compassionate reasoning within the stated boundaries."}`;

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

    let care: Record<string, unknown> | null = null;
    if (capability === "assistant.answer" && careAssessment) {
      let alertId: string | null = null;
      let alertCreated = false;
      if (careAssessment.autoEscalate) {
        try {
          const alert = await createPastoralAlert(auth, careAssessment, prompt, "automatic_safety");
          alertId = alert.id;
          alertCreated = true;
          const recipientNotice = alert.recipientCount > 0
            ? careAssessment.memberNotice
            : "Your message may indicate immediate danger. COT AI recorded a confidential safety alert, but no pastoral care recipient is currently assigned to this exact church space. Please contact local emergency services and a trusted person who can reach you now.";
          care = {
            category: careAssessment.category,
            severity: careAssessment.severity,
            offerPastoralSupport: true,
            alertCreated: true,
            alertId,
            recipientCount: alert.recipientCount,
            notice: recipientNotice,
          };
        } catch {
          care = {
            category: careAssessment.category,
            severity: careAssessment.severity,
            offerPastoralSupport: true,
            alertCreated: false,
            alertId: null,
            notice: "COT AI could not confirm that a pastoral alert was delivered. Please contact local emergency services and a trusted person who can physically reach you now, and contact a church leader directly when you can.",
          };
        }
      }
      if (!care) {
        care = {
          category: careAssessment.category,
          severity: careAssessment.severity,
          offerPastoralSupport: careAssessment.offerPastoralSupport,
          alertCreated,
          alertId,
          notice: careAssessment.memberNotice,
        };
      }
    }

    return { data: { ...result, ...(care ? { care } : {}) }, status: result.status === "requires_review" ? 202 : 200 };
  },
));