import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { uuid } from "../_shared/validation.ts";

const scopes = new Set(["all", "expression", "church"]);

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);

    if (request.method !== "GET") {
      throw new ApiError(
        "STREAMING_ADAPTER_REQUIRED",
        "Live broadcasts must be created and operated through the configured third-party streaming provider",
        409
      );
    }

    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") ?? "all";
    if (!scopes.has(scope)) throw new ApiError("VALIDATION_FAILED", "Invalid stream scope", 422);

    const expressionParam = url.searchParams.get("expressionId");
    const expressionId = expressionParam ? uuid(expressionParam, "expressionId", true)! : null;
    if (scope === "expression" && !auth.branchId && !expressionId) {
      throw new ApiError("EXPRESSION_REQUIRED", "Select an Expression to view its streams", 400);
    }
    if (auth.branchId && expressionId && auth.branchId !== expressionId) {
      throw new ApiError("EXPRESSION_SCOPE_DENIED", "The requested Expression does not match the selected context", 403);
    }

    let query = auth.client
      .from("live_streams")
      .select("id,organization_id,branch_id,group_id,event_id,title,description,status,visibility,provider,playback_url,playback_token_required,scheduled_start,started_at,ended_at,recording_url,thumbnail_url,latency_mode,created_at")
      .eq("organization_id", auth.organizationId)
      .order("scheduled_start", { ascending: false, nullsFirst: false })
      .limit(100);

    if (scope === "expression") query = query.eq("branch_id", expressionId ?? auth.branchId!);
    if (scope === "church") query = query.is("branch_id", null);
    if (expressionId && scope === "all") query = query.eq("branch_id", expressionId);

    const { data, error } = await query;
    if (error) throw new ApiError("STREAM_LIST_FAILED", "Unable to retrieve live streams", 500, undefined, false);

    return {
      data: (data ?? []).map((stream) => ({
        ...stream,
        playback_url: stream.playback_token_required ? null : stream.playback_url,
        recording_url: stream.playback_token_required ? null : stream.recording_url,
      })),
    };
  },
));
