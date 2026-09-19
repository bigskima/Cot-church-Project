import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorizePlatform } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const VARIANTS = new Set(["silver","gold","blue","teal","default","custom"]);

function color(value: unknown, name: string, fallback: string) {
  if (value === undefined || value === null || value === "") return fallback;
  const text = requiredString(value, name, 7).toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(text)) throw new ApiError("VALIDATION_FAILED", `${name} must be a six-digit hex color`, 422);
  return text;
}
function integer(value: unknown, name: string, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < -1000 || parsed > 1000) throw new ApiError("VALIDATION_FAILED", `${name} must be an integer`, 422);
  return parsed;
}
function codeFromLabel(label: string) {
  return label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "badge";
}
async function audit(admin: any, actor: string, action: string, targetId: string | null, requestId: string, metadata: Record<string, unknown>) {
  const { error } = await admin.from("platform_audit_log").insert({
    actor_profile_id: actor, action, target_type: "identity_badge", target_id: targetId, request_id: requestId, metadata,
  });
  if (error) throw new ApiError("PLATFORM_AUDIT_FAILED", "Change saved but the audit record could not be written", 500, undefined, false);
}
async function memberProfiles(admin: any, organizationId: string) {
  const { data: memberships, error } = await admin.from("memberships")
    .select("profile_id").eq("organization_id", organizationId).eq("status", "active").limit(3000);
  if (error) throw new ApiError("BADGE_MEMBERS_FAILED", "Unable to load church members", 500, undefined, false);
  const ids = [...new Set((memberships ?? []).map((row: any) => row.profile_id).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error: profileError } = await admin.from("profiles")
    .select("id,display_name,username,avatar_url").in("id", ids).order("display_name").limit(2000);
  if (profileError) throw new ApiError("BADGE_MEMBERS_FAILED", "Unable to load church member profiles", 500, undefined, false);
  return data ?? [];
}

Deno.serve(createHandler(
  { methods: ["GET","POST","PATCH","DELETE"], authentication: "required", organization: "none" },
  async ({ request, requestId, auth }) => {
    if (!auth?.user) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    await authorizePlatform(auth, "platform.identity_badges.manage");
    const admin = adminClient();
    const body = request.method === "GET" ? {} : assertObject(await jsonBody(request));
    const url = new URL(request.url);
    const organizationId = request.method === "GET"
      ? (url.searchParams.get("organizationId") ? uuid(url.searchParams.get("organizationId"), "organizationId", true)! : null)
      : uuid(requiredString(body.organizationId, "organizationId", 64), "organizationId", true)!;

    if (request.method === "GET") {
      const organizationsResult = await admin.from("organizations").select("id,name,slug,status").eq("status","active").order("name").limit(200);
      if (organizationsResult.error) throw new ApiError("BADGE_LOAD_FAILED", "Unable to load churches", 500, undefined, false);
      if (!organizationId) return { data: { organizations: organizationsResult.data ?? [], definitions: [], assignments: [], members: [] } };

      const [definitionsResult, assignmentsResult, members] = await Promise.all([
        admin.from("identity_badge_definitions")
          .select("id,organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,is_active,badge_variant,notify_priority_posts")
          .eq("organization_id", organizationId).is("branch_id", null).order("priority", { ascending: false }),
        admin.from("identity_badge_assignments")
          .select("id,organization_id,branch_id,profile_id,badge_definition_id,is_active,created_at,identity_badge_definitions!inner(id,label,background_color,text_color,priority,badge_variant)")
          .eq("organization_id", organizationId).is("branch_id", null).eq("is_active", true),
        memberProfiles(admin, organizationId),
      ]);
      if (definitionsResult.error || assignmentsResult.error) throw new ApiError("BADGE_LOAD_FAILED", "Unable to load public titles", 500, undefined, false);
      return { data: { organizations: organizationsResult.data ?? [], definitions: definitionsResult.data ?? [], assignments: assignmentsResult.data ?? [], members } };
    }

    const action = requiredString(body.action, "action", 40);

    if (action === "create_definition") {
      assertNoUnknownFields(body, ["action","organizationId","label","backgroundColor","textColor","priority","badgeVariant","notifyPriorityPosts"]);
      const label = requiredString(body.label, "label", 80).trim();
      const variant = body.badgeVariant === undefined ? "default" : requiredString(body.badgeVariant, "badgeVariant", 20);
      if (!VARIANTS.has(variant)) throw new ApiError("VALIDATION_FAILED", "Invalid badge style", 422);
      const { data, error } = await admin.from("identity_badge_definitions").insert({
        organization_id: organizationId,
        branch_id: null,
        code: `${codeFromLabel(label)}_${crypto.randomUUID().slice(0,6)}`,
        label,
        background_color: color(body.backgroundColor, "backgroundColor", "#475569"),
        text_color: color(body.textColor, "textColor", "#FFFFFF"),
        priority: integer(body.priority, "priority", 50),
        is_membership_default: false,
        is_active: true,
        badge_variant: variant,
        notify_priority_posts: body.notifyPriorityPosts === true,
        created_by: auth.user.id,
      }).select().single();
      if (error) throw new ApiError("BADGE_CREATE_FAILED", "Unable to create this public title", 500, undefined, false);
      await audit(admin, auth.user.id, "identity_badge.definition_created", data.id, requestId, { organizationId, label });
      return { data, status: 201 };
    }

    if (action === "update_definition") {
      assertNoUnknownFields(body, ["action","organizationId","definitionId","label","backgroundColor","textColor","priority","badgeVariant","notifyPriorityPosts","isActive"]);
      const definitionId = uuid(requiredString(body.definitionId, "definitionId", 36), "definitionId", true)!;
      const { data: current } = await admin.from("identity_badge_definitions").select("id,is_membership_default").eq("id", definitionId).eq("organization_id", organizationId).is("branch_id", null).maybeSingle();
      if (!current || current.is_membership_default) throw new ApiError("BADGE_NOT_FOUND", "This public title cannot be edited here", 404);
      const variant = body.badgeVariant === undefined ? undefined : requiredString(body.badgeVariant, "badgeVariant", 20);
      if (variant && !VARIANTS.has(variant)) throw new ApiError("VALIDATION_FAILED", "Invalid badge style", 422);
      const updates: Record<string, unknown> = {};
      if (body.label !== undefined) updates.label = requiredString(body.label, "label", 80).trim();
      if (body.backgroundColor !== undefined) updates.background_color = color(body.backgroundColor, "backgroundColor", "#475569");
      if (body.textColor !== undefined) updates.text_color = color(body.textColor, "textColor", "#FFFFFF");
      if (body.priority !== undefined) updates.priority = integer(body.priority, "priority", 50);
      if (variant) updates.badge_variant = variant;
      if (body.notifyPriorityPosts !== undefined) updates.notify_priority_posts = body.notifyPriorityPosts === true;
      if (body.isActive !== undefined) updates.is_active = body.isActive === true;
      const { data, error } = await admin.from("identity_badge_definitions").update(updates).eq("id", definitionId).select().single();
      if (error) throw new ApiError("BADGE_UPDATE_FAILED", "Unable to update this public title", 500, undefined, false);
      await audit(admin, auth.user.id, "identity_badge.definition_updated", definitionId, requestId, { organizationId });
      return { data };
    }

    if (action === "assign" || action === "revoke") {
      assertNoUnknownFields(body, ["action","organizationId","profileId","definitionId"]);
      const profileId = uuid(requiredString(body.profileId, "profileId", 36), "profileId", true)!;
      const definitionId = uuid(requiredString(body.definitionId, "definitionId", 36), "definitionId", true)!;
      const members = await memberProfiles(admin, organizationId);
      if (!members.some((member: any) => member.id === profileId)) throw new ApiError("MEMBER_NOT_FOUND", "Choose an active church member", 404);
      const { data: definition } = await admin.from("identity_badge_definitions").select("id,label").eq("id", definitionId).eq("organization_id", organizationId).is("branch_id", null).eq("is_active", true).maybeSingle();
      if (!definition) throw new ApiError("BADGE_NOT_FOUND", "Choose an active public title", 404);

      let existingQuery = admin.from("identity_badge_assignments").select("id").eq("organization_id", organizationId).eq("profile_id", profileId).eq("badge_definition_id", definitionId).is("branch_id", null);
      const { data: existing, error: existingError } = await existingQuery.maybeSingle();
      if (existingError) throw new ApiError("BADGE_ASSIGN_FAILED", "Unable to inspect this assignment", 500, undefined, false);

      if (action === "assign") {
        const result = existing?.id
          ? await admin.from("identity_badge_assignments").update({ is_active: true, assigned_by: auth.user.id }).eq("id", existing.id).select().single()
          : await admin.from("identity_badge_assignments").insert({ organization_id: organizationId, branch_id: null, profile_id: profileId, badge_definition_id: definitionId, assigned_by: auth.user.id, is_active: true }).select().single();
        if (result.error) throw new ApiError("BADGE_ASSIGN_FAILED", "Unable to assign this public title", 500, undefined, false);
        await audit(admin, auth.user.id, "identity_badge.assigned", result.data.id, requestId, { organizationId, profileId, definitionId });
        return { data: result.data };
      }

      if (existing?.id) {
        const result = await admin.from("identity_badge_assignments").update({ is_active: false, assigned_by: auth.user.id }).eq("id", existing.id);
        if (result.error) throw new ApiError("BADGE_REVOKE_FAILED", "Unable to remove this public title", 500, undefined, false);
        await audit(admin, auth.user.id, "identity_badge.revoked", existing.id, requestId, { organizationId, profileId, definitionId });
      }
      return { data: { active: false } };
    }

    throw new ApiError("VALIDATION_FAILED", "Unsupported public-title action", 422);
  },
));
