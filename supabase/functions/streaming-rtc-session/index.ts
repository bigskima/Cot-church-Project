import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { loadStreamingConfig } from "../_shared/streaming/configuration.ts";
import { streamingProvider } from "../_shared/streaming/registry.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

async function numericUid(profileId: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(profileId)));
  const value = new DataView(digest.buffer).getUint32(0, false);
  return value === 0 ? 1 : value;
}

Deno.serve(createHandler(
  { methods: ["POST"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["streamId", "role"]);
    const streamId = uuid(requiredString(body.streamId, "streamId", 64), "streamId", true)!;
    const role = requiredString(body.role, "role", 16);
    if (role !== "publisher" && role !== "subscriber") {
      throw new ApiError("VALIDATION_FAILED", "role must be publisher or subscriber", 422);
    }

    const admin = adminClient();
    const { data: stream, error } = await admin
      .from("live_streams")
      .select("id,organization_id,branch_id,status,visibility,provider_config_id,provider_broadcast_id,provider_metadata")
      .eq("id", streamId)
      .maybeSingle();
    if (error || !stream) throw new ApiError("STREAM_NOT_FOUND", "Broadcast not found", 404);
    if (!stream.branch_id || stream.visibility === "public") {
      throw new ApiError("STREAMING_SCOPE_UNSUPPORTED", "RTC sessions are reserved for Expression broadcasts", 409);
    }
    if (!stream.provider_config_id || !stream.provider_broadcast_id) {
      throw new ApiError("STREAM_PROVIDER_STATE_INVALID", "Broadcast is missing its RTC provider session", 409);
    }

    if (role === "publisher") {
      const { data: allowed, error: permissionError } = await auth.client.rpc("has_permission", {
        target_organization_id: stream.organization_id,
        requested_permission: "streams.broadcast",
        target_branch_id: stream.branch_id,
      });
      if (permissionError || allowed !== true) {
        throw new ApiError("PERMISSION_DENIED", "You cannot broadcast live in this Expression", 403);
      }
      if (["ended", "failed", "cancelled", "archived"].includes(stream.status)) {
        throw new ApiError("STREAM_NOT_ACTIVE", "This broadcast can no longer be started", 409);
      }
    } else {
      const { data: allowed, error: accessError } = await auth.client.rpc("can_access_stream", { target_stream_id: streamId });
      if (accessError || allowed !== true) {
        throw new ApiError("STREAM_ACCESS_DENIED", "You do not have access to this Expression broadcast", 403);
      }
      if (stream.status !== "live") {
        throw new ApiError("STREAM_NOT_LIVE", "This Expression broadcast has not started yet", 409);
      }
    }

    const loaded = await loadStreamingConfig(stream.provider_config_id);
    if (loaded.provider.providerCode !== "agora") {
      throw new ApiError("STREAMING_PLAYBACK_MODE_INVALID", "This broadcast does not use Agora RTC", 409);
    }
    const adapter = streamingProvider("agora");
    if (!adapter.createRtcGrant) {
      throw new ApiError("STREAMING_ADAPTER_UNAVAILABLE", "Agora RTC grant support is unavailable", 500, undefined, false);
    }

    const ttlSetting = Number(loaded.provider.settings?.tokenTtlSeconds ?? 3600);
    const ttlSeconds = Number.isFinite(ttlSetting) ? Math.max(300, Math.min(86400, Math.floor(ttlSetting))) : 3600;
    const uid = await numericUid(auth.user.id);
    const grant = await adapter.createRtcGrant(
      loaded.provider,
      stream.provider_broadcast_id,
      uid,
      role,
      ttlSeconds,
    );

    return {
      data: {
        streamId,
        expressionId: stream.branch_id,
        grant,
      },
      headers: { "Cache-Control": "private, no-store" },
    };
  },
));
