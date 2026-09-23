import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const scopes = new Set(["general", "expression"]);
const statuses = new Set(["new", "assigned", "contacted", "resolved", "closed"]);

async function requireScopeAccess(auth: any, organizationId: string, branchId: string | null) {
  const { data, error } = await auth.client.rpc("has_exact_scope_permission", {
    target_organization_id: organizationId,
    requested_permission: "pastoral.followups.receive",
    target_branch_id: branchId,
  });
  if (error || data !== true) {
    throw new ApiError("PERMISSION_DENIED", "Pastoral follow-up access is not assigned to you for this exact scope", 403);
  }
}


function mappedAiAlert(row: any) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    source: "ai",
    id: row.id,
    organization_id: row.organization_id,
    branch_id: row.branch_id ?? null,
    stream_id: null,
    stream_title: null,
    profile_id: row.profile_id,
    user_name: profile?.display_name ?? null,
    username: profile?.username ?? null,
    user_avatar: profile?.avatar_url ?? null,
    user_phone: profile?.phone_number ?? null,
    type: row.trigger_type === "urgent_safety" ? "ai_urgent_safety" : "ai_pastoral_request",
    risk_level: row.risk_level,
    category: row.category,
    status: row.status,
    private_note: row.private_note || row.member_message,
    member_message: row.member_message,
    assigned_to: row.assigned_to,
    consent_given: row.consent_given,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapped(row: any) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const stream = Array.isArray(row.live_streams) ? row.live_streams[0] : row.live_streams;
  return {
    source: "live",
    id: row.id,
    organization_id: row.organization_id,
    branch_id: row.branch_id ?? null,
    stream_id: row.stream_id,
    stream_title: stream?.title ?? null,
    profile_id: row.profile_id,
    user_name: profile?.display_name ?? null,
    user_avatar: profile?.avatar_url ?? null,
    user_phone: profile?.phone_number ?? null,
    type: row.type,
    status: row.status,
    private_note: row.private_note,
    assigned_to: row.assigned_to,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

Deno.serve(createHandler(
  { methods: ["GET", "PATCH"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Church context is required", 400);
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") ?? "general";
    if (!scopes.has(scope)) throw new ApiError("VALIDATION_FAILED", "Invalid pastoral follow-up scope", 422);
    const branchId = scope === "expression"
      ? uuid(url.searchParams.get("branchId") || auth.branchId, "branchId", true)!
      : null;

    await requireScopeAccess(auth, auth.organizationId, branchId);
    const admin = adminClient();

    if (request.method === "GET") {
      let query = admin
        .from("live_follow_ups")
        .select("id,organization_id,stream_id,profile_id,branch_id,type,status,private_note,assigned_to,created_at,updated_at,profiles!live_follow_ups_profile_id_fkey(display_name,avatar_url,phone_number),live_streams!live_follow_ups_stream_id_organization_id_fkey(title)")
        .eq("organization_id", auth.organizationId)
        .order("created_at", { ascending: false })
        .limit(100);
      query = branchId ? query.eq("branch_id", branchId) : query.is("branch_id", null);
      const aiQueryBase = admin
        .from("ai_pastoral_alerts")
        .select("id,organization_id,profile_id,branch_id,trigger_type,risk_level,category,member_message,consent_given,status,private_note,assigned_to,created_at,updated_at,profiles!ai_pastoral_alerts_profile_id_fkey(display_name,username,avatar_url,phone_number)")
        .eq("organization_id", auth.organizationId)
        .order("created_at", { ascending: false })
        .limit(100);
      const aiQuery = branchId ? aiQueryBase.eq("branch_id", branchId) : aiQueryBase.is("branch_id", null);
      const [{ data, error }, { data: aiAlerts, error: aiError }] = await Promise.all([query, aiQuery]);
      if (error || aiError) throw new ApiError("FOLLOWUP_LIST_FAILED", "Unable to retrieve pastoral follow-ups", 500, undefined, false);
      return {
        data: [
          ...(data ?? []).map(mapped),
          ...(aiAlerts ?? []).map(mappedAiAlert),
        ].sort((a:any,b:any)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0, 150),
      };
    }

    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["id", "source", "status", "privateNote", "assignedTo"]);
    const id = uuid(requiredString(body.id, "id", 36), "id", true)!;
    const source = optionalString(body.source, "source", 20) ?? "live";
    if (!["live","ai"].includes(source)) throw new ApiError("VALIDATION_FAILED", "Invalid follow-up source", 422);
    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) {
      const status = requiredString(body.status, "status", 20);
      if (!statuses.has(status)) throw new ApiError("VALIDATION_FAILED", "Invalid follow-up status", 422);
      updates.status = status;
    }
    if (body.privateNote !== undefined) updates.private_note = optionalString(body.privateNote, "privateNote", 5000) ?? "";
    if (body.assignedTo !== undefined) updates.assigned_to = body.assignedTo ? uuid(String(body.assignedTo), "assignedTo", true) : null;
    if (!Object.keys(updates).length) throw new ApiError("VALIDATION_FAILED", "At least one follow-up update is required", 422);

    if (source === "ai") {
      let update = admin
        .from("ai_pastoral_alerts")
        .update(updates)
        .eq("id", id)
        .eq("organization_id", auth.organizationId);
      update = branchId ? update.eq("branch_id", branchId) : update.is("branch_id", null);
      const { data, error } = await update
        .select("id,organization_id,profile_id,branch_id,trigger_type,risk_level,category,member_message,consent_given,status,private_note,assigned_to,created_at,updated_at,profiles!ai_pastoral_alerts_profile_id_fkey(display_name,username,avatar_url,phone_number)")
        .maybeSingle();
      if (error) throw new ApiError("FOLLOWUP_UPDATE_FAILED", "Unable to update AI pastoral alert", 500, undefined, false);
      if (!data) throw new ApiError("FOLLOWUP_NOT_FOUND", "AI pastoral alert was not found in this scope", 404);
      return { data: mappedAiAlert(data) };
    }

    let update = admin
      .from("live_follow_ups")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", auth.organizationId);
    update = branchId ? update.eq("branch_id", branchId) : update.is("branch_id", null);
    const { data, error } = await update
      .select("id,organization_id,stream_id,profile_id,branch_id,type,status,private_note,assigned_to,created_at,updated_at,profiles!live_follow_ups_profile_id_fkey(display_name,avatar_url,phone_number),live_streams!live_follow_ups_stream_id_organization_id_fkey(title)")
      .maybeSingle();
    if (error) throw new ApiError("FOLLOWUP_UPDATE_FAILED", "Unable to update pastoral follow-up", 500, undefined, false);
    if (!data) throw new ApiError("FOLLOWUP_NOT_FOUND", "Pastoral follow-up was not found in this scope", 404);
    return { data: mapped(data) };
  },
));
