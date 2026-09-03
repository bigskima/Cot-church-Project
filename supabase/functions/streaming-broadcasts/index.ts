import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { defaultStreamingConfig, loadStreamingConfig } from "../_shared/streaming/configuration.ts";
import { streamingProvider } from "../_shared/streaming/registry.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const visibilities = new Set(["public", "organization", "branch", "group", "private"]);
const latencies = new Set(["standard", "reduced", "low"]);

async function hasScopedPermission(auth: any, permission: string, branchId: string | null) {
  const { data, error } = await auth.client.rpc("has_permission", {
    target_organization_id: auth.organizationId,
    requested_permission: permission,
    target_branch_id: branchId,
  });
  return !error && data === true;
}

function reconnectWindow(value: unknown) {
  const seconds = value === undefined ? 60 : Number(value);
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 600) {
    throw new ApiError("VALIDATION_FAILED", "reconnectWindowSeconds must be 10-600", 422);
  }
  return seconds;
}

async function streamingReadiness(organizationId: string) {
  try {
    const loaded = await defaultStreamingConfig(organizationId);
    if (loaded.organizationId && loaded.organizationId !== organizationId) {
      return { ready: false, reason: "provider_scope_invalid" as const };
    }
    try {
      streamingProvider(loaded.provider.providerCode);
    } catch {
      return { ready: false, reason: "adapter_unavailable" as const, providerCode: loaded.provider.providerCode };
    }
    const primarySecretReady = Boolean(loaded.provider.secretReference && Deno.env.get(loaded.provider.secretReference)?.trim());
    const webhookSecretReady = Boolean(loaded.provider.webhookSecretReference && Deno.env.get(loaded.provider.webhookSecretReference)?.trim());
    if (!primarySecretReady || !webhookSecretReady) {
      return {
        ready: false,
        reason: "runtime_secrets_missing" as const,
        providerCode: loaded.provider.providerCode,
        primarySecretReady,
        webhookSecretReady,
      };
    }
    return {
      ready: true,
      reason: null,
      providerCode: loaded.provider.providerCode,
      signedPlaybackConfigured: Boolean(loaded.provider.signingKeyReference && Deno.env.get(loaded.provider.signingKeyReference)?.trim()),
    };
  } catch (error) {
    if (error instanceof ApiError && ["STREAMING_NOT_CONFIGURED", "STREAMING_PROVIDER_DISABLED"].includes(error.code)) {
      return { ready: false, reason: "provider_not_configured" as const };
    }
    throw error;
  }
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);

    if (request.method === "GET") {
      if (!(await hasScopedPermission(auth, "streams.broadcast", auth.branchId))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot operate live broadcasts in this scope", 403);
      }
      return { data: await streamingReadiness(auth.organizationId) };
    }

    const admin = adminClient();
    const body = assertObject(await jsonBody(request));

    if (request.method === "POST") {
      assertNoUnknownFields(body, [
        "title", "description", "visibility", "branchId", "groupId", "eventId", "scheduledStart",
        "latencyMode", "reconnectWindowSeconds", "record", "providerConfigId",
      ]);

      const suppliedBranchId = body.branchId ? uuid(String(body.branchId), "branchId", true)! : null;
      if (auth.branchId && suppliedBranchId && suppliedBranchId !== auth.branchId) {
        throw new ApiError("EXPRESSION_SCOPE_DENIED", "A broadcast can only be created inside the selected Expression", 403);
      }
      const targetBranchId = auth.branchId ?? suppliedBranchId;
      if (!(await hasScopedPermission(auth, "streams.broadcast", targetBranchId))) {
        throw new ApiError("PERMISSION_DENIED", "You cannot create broadcasts in this scope", 403);
      }

      const visibility = requiredString(body.visibility, "visibility", 20);
      const latencyMode = optionalString(body.latencyMode, "latencyMode", 20) ?? "reduced";
      if (!visibilities.has(visibility) || !latencies.has(latencyMode)) {
        throw new ApiError("VALIDATION_FAILED", "Invalid stream visibility or latency mode", 422);
      }
      if (visibility === "branch" && !targetBranchId) {
        throw new ApiError("VALIDATION_FAILED", "Expression visibility requires an Expression-scoped broadcast", 422);
      }

      const groupId = body.groupId ? uuid(String(body.groupId), "groupId", true)! : null;
      if (visibility === "group" && !groupId) throw new ApiError("VALIDATION_FAILED", "Group visibility requires a group", 422);
      if (groupId) {
        const { data: group, error: groupError } = await admin
          .from("groups")
          .select("id,branch_id,is_active")
          .eq("id", groupId)
          .eq("organization_id", auth.organizationId)
          .maybeSingle();
        if (groupError || !group || !group.is_active) throw new ApiError("GROUP_NOT_FOUND", "Group is unavailable", 404);
        if (group.branch_id !== targetBranchId) throw new ApiError("EXPRESSION_SCOPE_DENIED", "The selected group is outside this broadcast scope", 403);
      }

      const eventId = body.eventId ? uuid(String(body.eventId), "eventId", true)! : null;
      if (eventId) {
        const { data: event, error: eventError } = await admin
          .from("events")
          .select("id,branch_id")
          .eq("id", eventId)
          .eq("organization_id", auth.organizationId)
          .maybeSingle();
        if (eventError || !event) throw new ApiError("EVENT_NOT_FOUND", "Event is unavailable", 404);
        if (event.branch_id !== null && event.branch_id !== targetBranchId) {
          throw new ApiError("EXPRESSION_SCOPE_DENIED", "The selected event belongs to another Expression", 403);
        }
      }

      const loaded = body.providerConfigId
        ? await loadStreamingConfig(uuid(String(body.providerConfigId), "providerConfigId", true)!)
        : await defaultStreamingConfig(auth.organizationId);
      if (loaded.organizationId && loaded.organizationId !== auth.organizationId) throw new ApiError("PROVIDER_SCOPE_DENIED", "Provider configuration is outside this organization", 403);
      if (!loaded.provider.secretReference || !Deno.env.get(loaded.provider.secretReference)?.trim() || !loaded.provider.webhookSecretReference || !Deno.env.get(loaded.provider.webhookSecretReference)?.trim()) {
        throw new ApiError("STREAMING_NOT_READY", "The active streaming provider is missing required runtime secrets", 503, undefined, false);
      }

      const adapter = streamingProvider(loaded.provider.providerCode);
      const title = requiredString(body.title, "title", 180).trim();
      const windowSeconds = reconnectWindow(body.reconnectWindowSeconds);
      const provisioned = await adapter.createBroadcast(loaded.provider, {
        title,
        visibility: visibility as never,
        latencyMode: latencyMode as never,
        reconnectWindowSeconds: windowSeconds,
        record: body.record !== false,
      });

      const record = {
        organization_id: auth.organizationId,
        branch_id: targetBranchId,
        group_id: groupId,
        event_id: eventId,
        title,
        description: optionalString(body.description, "description", 10000)?.trim() ?? "",
        visibility,
        status: "provisioning",
        provider: loaded.provider.providerCode,
        provider_config_id: loaded.id,
        provider_broadcast_id: provisioned.providerBroadcastId,
        playback_url: provisioned.publicPlaybackUrl ?? null,
        playback_token_required: visibility !== "public",
        scheduled_start: body.scheduledStart ?? null,
        latency_mode: latencyMode,
        reconnect_window_seconds: windowSeconds,
        provider_metadata: { playbackId: provisioned.playbackId },
        created_by: auth.user.id,
      };

      const { data, error } = await admin.from("live_streams").insert(record).select("id,branch_id,title,status,visibility,scheduled_start,latency_mode,created_at").single();
      if (error) {
        await adapter.stopBroadcast(loaded.provider, provisioned.providerBroadcastId).catch(() => {});
        throw new ApiError("BROADCAST_CREATE_FAILED", "Provider was rolled back after the broadcast record failed", 500, undefined, false);
      }
      return { data: { stream: data, ingest: provisioned.ingest }, status: 201 };
    }

    assertNoUnknownFields(body, ["id", "action", "startSeconds", "endSeconds", "title"]);
    const id = uuid(requiredString(body.id, "id", 36), "id", true)!;
    const { data: stream, error } = await admin
      .from("live_streams")
      .select("id,organization_id,branch_id,provider_config_id,provider_broadcast_id,provider_asset_id,status")
      .eq("id", id)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();
    if (error || !stream) throw new ApiError("STREAM_NOT_FOUND", "Broadcast not found", 404);
    if (auth.branchId && stream.branch_id !== auth.branchId) throw new ApiError("EXPRESSION_SCOPE_DENIED", "This broadcast belongs to another Expression", 403);
    if (!(await hasScopedPermission(auth, "streams.broadcast", stream.branch_id))) throw new ApiError("PERMISSION_DENIED", "You cannot operate this broadcast", 403);
    if (!stream.provider_config_id || !stream.provider_broadcast_id) throw new ApiError("STREAM_PROVIDER_STATE_INVALID", "This broadcast is not linked to a real provider lifecycle", 409);

    const loaded = await loadStreamingConfig(stream.provider_config_id);
    if (loaded.organizationId && loaded.organizationId !== auth.organizationId) throw new ApiError("PROVIDER_SCOPE_DENIED", "Broadcast provider configuration is outside this organization", 403);
    const adapter = streamingProvider(loaded.provider.providerCode);
    const action = requiredString(body.action, "action", 30);

    if (action === "stop") {
      if (["ended", "cancelled", "archived"].includes(stream.status)) return { data: { id, status: stream.status } };
      await adapter.stopBroadcast(loaded.provider, stream.provider_broadcast_id);
      const endedAt = new Date().toISOString();
      const { error: updateError } = await admin.from("live_streams").update({ status: "ended", ended_at: endedAt }).eq("id", id);
      if (updateError) throw new ApiError("STREAM_UPDATE_FAILED", "Provider stopped but stream state could not be finalized", 500, undefined, false);
      return { data: { id, status: "ended", endedAt } };
    }

    if (action === "refresh_status") {
      const status = await adapter.getStreamStatus(loaded.provider, stream.provider_broadcast_id);
      const { error: updateError } = await admin.from("live_streams").update({ status }).eq("id", id);
      if (updateError) throw new ApiError("STREAM_UPDATE_FAILED", "Unable to persist provider stream status", 500, undefined, false);
      return { data: { id, status } };
    }

    throw new ApiError("VALIDATION_FAILED", "Unsupported broadcast action", 422);
  },
));
