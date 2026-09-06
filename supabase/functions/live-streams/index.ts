import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validation.ts";

const scopes = new Set(["expression", "church"]);

async function resolveOrganizationId(raw?: string | null) {
  const admin = adminClient();
  if (raw) {
    const id = uuid(raw, "organizationId", true)!;
    const { data, error } = await admin
      .from("organizations")
      .select("id,status")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle();
    if (error || !data) throw new ApiError("ORGANIZATION_NOT_FOUND", "This church community is not available", 404);
    return id;
  }

  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(2);
  if (error) throw new ApiError("ORGANIZATION_LOOKUP_FAILED", "Unable to resolve the church community", 500, undefined, false);
  if ((data ?? []).length === 1) return data![0].id;
  throw new ApiError("ORGANIZATION_REQUIRED", "Choose a church to view its broadcasts", 422);
}

async function hasScopedPermission(auth: any, organizationId: string, branchId: string) {
  const { data, error } = await auth.client.rpc("has_permission", {
    target_organization_id: organizationId,
    requested_permission: "streams.broadcast",
    target_branch_id: branchId,
  });
  return !error && data === true;
}

async function hasPublicCapability(auth: any) {
  const { data, error } = await auth.client.rpc("has_public_capability", {
    requested_permission: "public.live_stream.create",
  });
  return !error && data === true;
}

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);

    const url = new URL(request.url);
    const organizationId = await resolveOrganizationId(url.searchParams.get("organizationId"));
    const scope = url.searchParams.get("scope") ?? "church";
    if (!scopes.has(scope)) throw new ApiError("VALIDATION_FAILED", "Invalid broadcast management scope", 422);

    const admin = adminClient();
    let query = admin
      .from("live_streams")
      .select("id,organization_id,branch_id,group_id,event_id,title,description,status,visibility,provider,playback_url,playback_token_required,scheduled_start,started_at,ended_at,recording_url,thumbnail_url,latency_mode,created_at")
      .eq("organization_id", organizationId)
      .order("scheduled_start", { ascending: false, nullsFirst: false })
      .limit(100);

    if (scope === "church") {
      if (!(await hasPublicCapability(auth))) {
        throw new ApiError("PUBLIC_LIVE_PERMISSION_REQUIRED", "Public live broadcasting has not been assigned to this account", 403);
      }
      query = query.is("branch_id", null).eq("visibility", "public");
    } else {
      const expressionId = uuid(url.searchParams.get("expressionId"), "expressionId", true)!;
      if (!(await hasScopedPermission(auth, organizationId, expressionId))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot manage broadcasts in this Expression", 403);
      }
      const { data: expression, error: expressionError } = await admin
        .from("branches")
        .select("id,is_active")
        .eq("id", expressionId)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .maybeSingle();
      if (expressionError || !expression) throw new ApiError("EXPRESSION_NOT_FOUND", "This Expression is unavailable", 404);
      query = query.eq("branch_id", expressionId);
    }

    const { data, error } = await query;
    if (error) throw new ApiError("STREAM_LIST_FAILED", "Unable to retrieve live broadcasts", 500, undefined, false);

    return {
      data: (data ?? []).map((stream) => ({
        ...stream,
        playback_url: stream.playback_token_required ? null : stream.playback_url,
        recording_url: stream.playback_token_required ? null : stream.recording_url,
      })),
    };
  },
));
