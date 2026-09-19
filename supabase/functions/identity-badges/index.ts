import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const VARIANTS = new Set(["silver","gold","blue","teal","default","custom"]);

function optionalUuid(value: unknown, name: string) {
  return value ? uuid(String(value), name, true)! : null;
}

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
  const base = label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
  return base || `badge_${crypto.randomUUID().slice(0, 8)}`;
}

async function canManage(auth: any, branchId: string | null) {
  const permission = branchId ? "expression.leadership.manage" : "organization.leadership.manage";
  const { data, error } = await auth.client.rpc("has_permission", {
    target_organization_id: auth.organizationId,
    requested_permission: permission,
    target_branch_id: branchId,
  });
  if (error) throw new ApiError("BADGE_PERMISSION_CHECK_FAILED", "Unable to verify public-title access", 500, undefined, false);
  if (data !== true) throw new ApiError("PERMISSION_DENIED", "You do not have access to manage public titles in this scope", 403);
}

async function activeProfiles(admin: any, organizationId: string, branchId: string | null) {
  const ids: string[] = [];
  if (branchId) {
    const { data, error } = await admin.from("expression_memberships")
      .select("profile_id")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("status", "active")
      .limit(2000);
    if (error) throw new ApiError("BADGE_MEMBERS_FAILED", "Unable to load Expression members", 500, undefined, false);
    ids.push(...(data ?? []).map((row: any) => row.profile_id).filter(Boolean));
  } else {
    const { data, error } = await admin.from("memberships")
      .select("profile_id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .limit(3000);
    if (error) throw new ApiError("BADGE_MEMBERS_FAILED", "Unable to load church members", 500, undefined, false);
    ids.push(...(data ?? []).map((row: any) => row.profile_id).filter(Boolean));
  }
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const { data, error } = await admin.from("profiles")
    .select("id,display_name,username,avatar_url")
    .in("id", unique)
    .order("display_name")
    .limit(2000);
  if (error) throw new ApiError("BADGE_MEMBERS_FAILED", "Unable to load member profiles", 500, undefined, false);
  return data ?? [];
}

Deno.serve(createHandler(
  { methods: ["GET","POST","PATCH","DELETE"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.user || !auth.organizationId) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication and church context are required", 401);
    const admin = adminClient();
    const url = new URL(request.url);
    const body = request.method === "GET" ? {} : assertObject(await jsonBody(request));
    const branchId = request.method === "GET"
      ? optionalUuid(url.searchParams.get("branchId"), "branchId")
      : optionalUuid(body.branchId, "branchId");

    await canManage(auth, branchId);

    if (branchId) {
      const { data: branch, error } = await admin.from("branches")
        .select("id,organization_id,name,is_active")
        .eq("id", branchId)
        .eq("organization_id", auth.organizationId)
        .eq("is_active", true)
        .maybeSingle();
      if (error || !branch) throw new ApiError("EXPRESSION_NOT_FOUND", "This Expression is unavailable", 404);
    }

    if (request.method === "GET") {
      let definitionsQuery = admin.from("identity_badge_definitions")
        .select("id,organization_id,branch_id,code,label,background_color,text_color,priority,is_membership_default,is_active,badge_variant,notify_priority_posts")
        .eq("organization_id", auth.organizationId)
        .order("priority", { ascending: false });
      definitionsQuery = branchId ? definitionsQuery.eq("branch_id", branchId) : definitionsQuery.is("branch_id", null);

      let assignmentsQuery = admin.from("identity_badge_assignments")
        .select("id,organization_id,branch_id,profile_id,badge_definition_id,is_active,created_at,identity_badge_definitions!inner(id,label,background_color,text_color,priority,badge_variant)")
        .eq("organization_id", auth.organizationId)
        .eq("is_active", true);
      assignmentsQuery = branchId ? assignmentsQuery.eq("branch_id", branchId) : assignmentsQuery.is("branch_id", null);

      const [definitionsResult, assignmentsResult, members] = await Promise.all([
        definitionsQuery,
        assignmentsQuery,
        activeProfiles(admin, auth.organizationId, branchId),
      ]);
      if (definitionsResult.error || assignmentsResult.error) throw new ApiError("BADGE_LOAD_FAILED", "Unable to load public titles", 500, undefined, false);

      return { data: { scope: branchId ? "expression" : "general", branchId, definitions: definitionsResult.data ?? [], assignments: assignmentsResult.data ?? [], members } };
    }

    const action = requiredString(body.action, "action", 40);

    if (action === "create_definition") {
      assertNoUnknownFields(body, ["action","branchId","label","backgroundColor","textColor","priority","badgeVariant","notifyPriorityPosts"]);
      const label = requiredString(body.label, "label", 80).trim();
      const variant = body.badgeVariant === undefined ? "default" : requiredString(body.badgeVariant, "badgeVariant", 20);
      if (!VARIANTS.has(variant)) throw new ApiError("VALIDATION_FAILED", "Invalid badge style", 422);
      const payload = {
        organization_id: auth.organizationId,
        branch_id: branchId,
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
      };
      const { data, error } = await admin.from("identity_badge_definitions").insert(payload).select().single();
      if (error) throw new ApiError("BADGE_CREATE_FAILED", "Unable to create this public title", 500, undefined, false);
      return { data, status: 201 };
    }

    if (action === "update_definition") {
      assertNoUnknownFields(body, ["action","branchId","definitionId","label","backgroundColor","textColor","priority","badgeVariant","notifyPriorityPosts","isActive"]);
      const definitionId = uuid(requiredString(body.definitionId, "definitionId", 36), "definitionId", true)!;
      const { data: existing } = await admin.from("identity_badge_definitions")
        .select("id,is_membership_default")
        .eq("id", definitionId)
        .eq("organization_id", auth.organizationId)
        .maybeSingle();
      if (!existing || existing.is_membership_default) throw new ApiError("BADGE_NOT_FOUND", "This public title cannot be edited here", 404);
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
      let query = admin.from("identity_badge_definitions").update(updates)
        .eq("id", definitionId).eq("organization_id", auth.organizationId);
      query = branchId ? query.eq("branch_id", branchId) : query.is("branch_id", null);
      const { data, error } = await query.select().single();
      if (error) throw new ApiError("BADGE_UPDATE_FAILED", "Unable to update this public title", 500, undefined, false);
      return { data };
    }

    if (action === "assign" || action === "revoke") {
      assertNoUnknownFields(body, ["action","branchId","profileId","definitionId"]);
      const profileId = uuid(requiredString(body.profileId, "profileId", 36), "profileId", true)!;
      const definitionId = uuid(requiredString(body.definitionId, "definitionId", 36), "definitionId", true)!;
      const members = await activeProfiles(admin, auth.organizationId, branchId);
      if (!members.some((member: any) => member.id === profileId)) throw new ApiError("MEMBER_NOT_FOUND", "Choose an active member in this scope", 404);
      let definitionQuery = admin.from("identity_badge_definitions")
        .select("id")
        .eq("id", definitionId)
        .eq("organization_id", auth.organizationId)
        .eq("is_active", true);
      definitionQuery = branchId ? definitionQuery.eq("branch_id", branchId) : definitionQuery.is("branch_id", null);
      const { data: definition } = await definitionQuery.maybeSingle();
      if (!definition) throw new ApiError("BADGE_NOT_FOUND", "Choose an active public title from this scope", 404);

      if (action === "assign") {
        const { data, error } = await admin.from("identity_badge_assignments").upsert({
          organization_id: auth.organizationId,
          branch_id: branchId,
          profile_id: profileId,
          badge_definition_id: definitionId,
          assigned_by: auth.user.id,
          is_active: true,
        }, { onConflict: branchId ? "branch_id,profile_id,badge_definition_id" : "organization_id,profile_id,badge_definition_id" }).select().single();
        if (error) {
          const { data: existing } = await admin.from("identity_badge_assignments")
            .select("id")
            .eq("organization_id", auth.organizationId)
            .eq("profile_id", profileId)
            .eq("badge_definition_id", definitionId)
            .is("branch_id", branchId)
            .maybeSingle();
          if (existing?.id) {
            const updated = await admin.from("identity_badge_assignments").update({ is_active: true, assigned_by: auth.user.id }).eq("id", existing.id).select().single();
            if (!updated.error) return { data: updated.data };
          }
          throw new ApiError("BADGE_ASSIGN_FAILED", "Unable to assign this public title", 500, undefined, false);
        }
        return { data };
      }

      let revokeQuery = admin.from("identity_badge_assignments")
        .update({ is_active: false, assigned_by: auth.user.id })
        .eq("organization_id", auth.organizationId)
        .eq("profile_id", profileId)
        .eq("badge_definition_id", definitionId);
      revokeQuery = branchId ? revokeQuery.eq("branch_id", branchId) : revokeQuery.is("branch_id", null);
      const { error } = await revokeQuery;
      if (error) throw new ApiError("BADGE_REVOKE_FAILED", "Unable to remove this public title", 500, undefined, false);
      return { data: { active: false } };
    }

    throw new ApiError("VALIDATION_FAILED", "Unsupported public-title action", 422);
  },
));
