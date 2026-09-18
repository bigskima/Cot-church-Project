import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { resolveSecretValue } from "../_shared/secrets.ts";
import { defaultStreamingConfig, loadStreamingConfig } from "../_shared/streaming/configuration.ts";
import { streamingProvider } from "../_shared/streaming/registry.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const visibilities = new Set(["public", "branch", "group", "private"]);
const latencies = new Set(["standard", "reduced", "low"]);

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
  throw new ApiError("ORGANIZATION_REQUIRED", "Choose a church before operating a broadcast", 422);
}

async function hasScopedPermission(auth: any, organizationId: string, permission: string, branchId: string | null) {
  const { data, error } = await auth.client.rpc("has_permission", {
    target_organization_id: organizationId,
    requested_permission: permission,
    target_branch_id: branchId,
  });
  return !error && data === true;
}

async function hasPublicCapability(auth: any, permission: string) {
  const { data, error } = await auth.client.rpc("has_public_capability", {
    requested_permission: permission,
  });
  return !error && data === true;
}

async function assertBroadcastAuthority(auth: any, organizationId: string, branchId: string | null) {
  if (branchId) {
    if (!(await hasScopedPermission(auth, organizationId, "streams.broadcast", branchId))) {
      throw new ApiError("PERMISSION_DENIED", "You cannot operate live broadcasts in this Expression", 403);
    }
    return;
  }
  if (!(await hasPublicCapability(auth, "public.live_stream.create"))) {
    throw new ApiError("PUBLIC_LIVE_PERMISSION_REQUIRED", "Public live broadcasting has not been assigned to this account", 403);
  }
}

function reconnectWindow(value: unknown) {
  const seconds = value === undefined ? 60 : Number(value);
  if (!Number.isInteger(seconds) || seconds < 10 || seconds > 600) {
    throw new ApiError("VALIDATION_FAILED", "reconnectWindowSeconds must be 10-600", 422);
  }
  return seconds;
}

async function numericUid(profileId: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(profileId)));
  const value = new DataView(digest.buffer).getUint32(0, false);
  return value === 0 ? 1 : value;
}

async function secretReady(reference?: string | null) {
  if (!reference) return false;
  try {
    return Boolean((await resolveSecretValue(reference)).trim());
  } catch {
    return false;
  }
}

async function streamingReadiness(organizationId: string, routeScope: 'general' | 'expression') {
  try {
    const loaded = await defaultStreamingConfig(organizationId, routeScope);
    if (loaded.organizationId && loaded.organizationId !== organizationId) {
      return { ready: false, reason: "provider_scope_invalid" as const };
    }
    const providerCode = loaded.provider.providerCode;
    if (providerCode !== "youtube") {
      try {
        streamingProvider(providerCode);
      } catch {
        return { ready: false, reason: "adapter_unavailable" as const, providerCode };
      }
    }
    const primarySecretReady = await secretReady(loaded.provider.secretReference);
    const webhookSecretReady = providerCode === "mux"
      ? await secretReady(loaded.provider.webhookSecretReference)
      : true;
    const signingSecretReady = providerCode === "mux"
      ? await secretReady(loaded.provider.signingKeyReference)
      : false;

    const channelConfigured = providerCode !== "youtube"
      || (typeof loaded.provider.settings?.channelId === "string" && Boolean(String(loaded.provider.settings.channelId).trim()));

    if (providerCode === "agora" && routeScope === "expression" && loaded.provider.settings?.cohostAuthenticationEnabled !== true) {
      return {
        ready: false,
        reason: "agora_cohost_auth_required" as const,
        providerCode,
        primarySecretReady,
        webhookSecretReady,
        signedPlaybackConfigured: false,
        operationMode: "rtc" as const,
        testMode: false,
      };
    }
    if (!primarySecretReady || !webhookSecretReady || !channelConfigured) {
      return {
        ready: false,
        reason: !channelConfigured ? "youtube_channel_missing" as const : "runtime_secrets_missing" as const,
        providerCode,
        primarySecretReady,
        webhookSecretReady,
        signedPlaybackConfigured: signingSecretReady,
        operationMode: providerCode === "youtube" ? "external" as const : providerCode === "agora" ? "rtc" as const : "managed" as const,
        testMode: loaded.provider.settings?.testMode === true,
      };
    }
    if (providerCode === "mux" && routeScope === "expression" && !signingSecretReady) {
      return {
        ready: false,
        reason: "signed_playback_not_configured" as const,
        providerCode,
        primarySecretReady,
        webhookSecretReady,
        signedPlaybackConfigured: false,
        operationMode: "managed" as const,
        testMode: loaded.provider.settings?.testMode === true,
      };
    }
    return {
      ready: true,
      reason: null,
      providerCode,
      signedPlaybackConfigured: signingSecretReady,
      operationMode: providerCode === "youtube" ? "external" as const : providerCode === "agora" ? "rtc" as const : "managed" as const,
      testMode: loaded.provider.settings?.testMode === true,
    };
  } catch (error) {
    if (error instanceof ApiError && ["STREAMING_NOT_CONFIGURED", "STREAMING_PROVIDER_DISABLED"].includes(error.code)) {
      return { ready: false, reason: "provider_not_configured" as const };
    }
    throw error;
  }
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);

    if (request.method === "GET") {
      const url = new URL(request.url);
      const organizationId = await resolveOrganizationId(url.searchParams.get("organizationId"));
      const branchId = url.searchParams.get("branchId")
        ? uuid(url.searchParams.get("branchId"), "branchId", true)!
        : null;
      await assertBroadcastAuthority(auth, organizationId, branchId);
      return { data: await streamingReadiness(organizationId, branchId ? 'expression' : 'general') };
    }

    const admin = adminClient();
    const body = assertObject(await jsonBody(request));

    if (request.method === "POST") {
      assertNoUnknownFields(body, [
        "organizationId", "title", "description", "visibility", "branchId", "groupId", "eventId", "scheduledStart",
        "latencyMode", "reconnectWindowSeconds", "record", "providerConfigId",
      ]);

      const organizationId = await resolveOrganizationId(body.organizationId ? String(body.organizationId) : null);
      const targetBranchId = body.branchId ? uuid(String(body.branchId), "branchId", true)! : null;
      await assertBroadcastAuthority(auth, organizationId, targetBranchId);

      const visibility = requiredString(body.visibility, "visibility", 20);
      const latencyMode = optionalString(body.latencyMode, "latencyMode", 20) ?? "reduced";
      if (!visibilities.has(visibility) || !latencies.has(latencyMode)) {
        throw new ApiError("VALIDATION_FAILED", "Invalid stream visibility or latency mode", 422);
      }

      // Root public broadcasts belong to General Community. Expression streams
      // stay inside their selected Expression unless a separate outward-publish
      // workflow is introduced later.
      if (!targetBranchId && visibility !== "public") {
        throw new ApiError("PUBLIC_SCOPE_REQUIRED", "General Community broadcasts must use public visibility", 422);
      }
      if (targetBranchId && visibility === "public") {
        throw new ApiError("EXPRESSION_PUBLICATION_REQUIRES_SEPARATE_FLOW", "Create public broadcasts from General Community, not from inside an Expression", 422);
      }
      if (visibility === "branch" && !targetBranchId) {
        throw new ApiError("VALIDATION_FAILED", "Expression visibility requires an Expression-scoped broadcast", 422);
      }

      if (targetBranchId) {
        const { data: branch, error: branchError } = await admin
          .from("branches")
          .select("id,is_active")
          .eq("id", targetBranchId)
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .maybeSingle();
        if (branchError || !branch) throw new ApiError("EXPRESSION_NOT_FOUND", "This Expression is unavailable", 404);
      }

      const groupId = body.groupId ? uuid(String(body.groupId), "groupId", true)! : null;
      if (visibility === "group" && !groupId) throw new ApiError("VALIDATION_FAILED", "Group visibility requires a group", 422);
      if (groupId) {
        if (!targetBranchId) throw new ApiError("VALIDATION_FAILED", "Group broadcasts must belong to an Expression", 422);
        const { data: group, error: groupError } = await admin
          .from("groups")
          .select("id,branch_id,is_active")
          .eq("id", groupId)
          .eq("organization_id", organizationId)
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
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (eventError || !event) throw new ApiError("EVENT_NOT_FOUND", "Event is unavailable", 404);
        if (event.branch_id !== null && event.branch_id !== targetBranchId) {
          throw new ApiError("EXPRESSION_SCOPE_DENIED", "The selected event belongs to another Expression", 403);
        }
      }

      const loaded = body.providerConfigId
        ? await loadStreamingConfig(uuid(String(body.providerConfigId), "providerConfigId", true)!)
        : await defaultStreamingConfig(organizationId, targetBranchId ? "expression" : "general");
      if (loaded.organizationId && loaded.organizationId !== organizationId) throw new ApiError("PROVIDER_SCOPE_DENIED", "Provider configuration is outside this organization", 403);
      const providerCode = loaded.provider.providerCode;
      if (providerCode === "youtube") {
        throw new ApiError(
          "EXTERNAL_LIVE_SOURCE",
          "General COT live video is sourced from the configured YouTube channel. Start the broadcast on YouTube; COT will discover it automatically.",
          409,
        );
      }
      if (!(await secretReady(loaded.provider.secretReference))) {
        throw new ApiError("STREAMING_NOT_READY", "The active streaming provider is missing required runtime credentials", 503, undefined, false);
      }
      if (providerCode === "mux" && !(await secretReady(loaded.provider.webhookSecretReference))) {
        throw new ApiError("STREAMING_NOT_READY", "Mux webhook verification is not configured", 503, undefined, false);
      }
      if (providerCode === "mux" && visibility !== "public" && !(await secretReady(loaded.provider.signingKeyReference))) {
        throw new ApiError(
          "STREAMING_SIGNING_NOT_CONFIGURED",
          "Secure playback must be configured before creating an Expression or private broadcast",
          503,
          undefined,
          false,
        );
      }
      if (providerCode === "agora" && visibility === "public") {
        throw new ApiError("STREAMING_SCOPE_UNSUPPORTED", "Agora is configured for Expression broadcasts, not General COT", 422);
      }
      if (providerCode === "agora" && loaded.provider.settings?.cohostAuthenticationEnabled !== true) {
        throw new ApiError(
          "AGORA_COHOST_AUTH_REQUIRED",
          "Expression live is disabled until Agora Co-host token authentication is enabled and confirmed in Platform Administration",
          503,
          undefined,
          false,
        );
      }

      const adapter = streamingProvider(providerCode);
      const title = requiredString(body.title, "title", 180).trim();
      const windowSeconds = reconnectWindow(body.reconnectWindowSeconds);
      const provisioned = await adapter.createBroadcast(loaded.provider, {
        title,
        visibility: visibility as never,
        latencyMode: latencyMode as never,
        reconnectWindowSeconds: windowSeconds,
        record: body.record !== false,
      });

      let rtcGrant: unknown = null;
      if (providerCode === "agora") {
        if (!adapter.createRtcGrant) {
          throw new ApiError("STREAMING_ADAPTER_UNAVAILABLE", "Agora RTC grant support is unavailable", 500, undefined, false);
        }
        const ttlSetting = Number(loaded.provider.settings?.tokenTtlSeconds ?? 3600);
        const ttlSeconds = Number.isFinite(ttlSetting) ? Math.max(300, Math.min(86400, Math.floor(ttlSetting))) : 3600;
        rtcGrant = await adapter.createRtcGrant(
          loaded.provider,
          provisioned.providerBroadcastId,
          await numericUid(auth.user.id),
          "publisher",
          ttlSeconds,
        );
      }

      const record = {
        organization_id: organizationId,
        branch_id: targetBranchId,
        group_id: groupId,
        event_id: eventId,
        title,
        description: optionalString(body.description, "description", 10000)?.trim() ?? "",
        visibility,
        status: loaded.provider.providerCode === "agora" ? "ready" : "provisioning",
        provider: loaded.provider.providerCode,
        provider_config_id: loaded.id,
        provider_broadcast_id: provisioned.providerBroadcastId,
        playback_url: provisioned.publicPlaybackUrl ?? null,
        playback_token_required: visibility !== "public",
        scheduled_start: body.scheduledStart ?? null,
        latency_mode: latencyMode,
        reconnect_window_seconds: windowSeconds,
        provider_metadata: { playbackId: provisioned.playbackId, rtc: provisioned.rtc ?? null },
        created_by: auth.user.id,
      };

      const { data, error } = await admin.from("live_streams").insert(record).select("id,branch_id,title,status,visibility,scheduled_start,latency_mode,created_at").single();
      if (error) {
        await adapter.stopBroadcast(loaded.provider, provisioned.providerBroadcastId).catch(() => {});
        throw new ApiError("BROADCAST_CREATE_FAILED", "Provider was rolled back after the broadcast record failed", 500, undefined, false);
      }
      return { data: { stream: data, ingest: provisioned.ingest, rtc: provisioned.rtc ?? null, rtcGrant, providerCode: loaded.provider.providerCode }, status: 201 };
    }

    assertNoUnknownFields(body, ["id", "action", "startSeconds", "endSeconds", "title"]);
    const id = uuid(requiredString(body.id, "id", 36), "id", true)!;
    const { data: stream, error } = await admin
      .from("live_streams")
      .select("id,organization_id,branch_id,provider_config_id,provider_broadcast_id,provider_asset_id,status")
      .eq("id", id)
      .maybeSingle();
    if (error || !stream) throw new ApiError("STREAM_NOT_FOUND", "Broadcast not found", 404);

    await assertBroadcastAuthority(auth, stream.organization_id, stream.branch_id);
    if (!stream.provider_config_id || !stream.provider_broadcast_id) throw new ApiError("STREAM_PROVIDER_STATE_INVALID", "This broadcast is not linked to a real provider lifecycle", 409);

    const loaded = await loadStreamingConfig(stream.provider_config_id);
    if (loaded.organizationId && loaded.organizationId !== stream.organization_id) throw new ApiError("PROVIDER_SCOPE_DENIED", "Broadcast provider configuration is outside this organization", 403);
    const adapter = streamingProvider(loaded.provider.providerCode);
    const action = requiredString(body.action, "action", 30);

    if (action === "mark_live") {
      if (loaded.provider.providerCode !== "agora") {
        throw new ApiError("STREAMING_ACTION_UNSUPPORTED", "Only RTC broadcasts use host-driven live status", 409);
      }
      const startedAt = new Date().toISOString();
      const { error: updateError } = await admin
        .from("live_streams")
        .update({ status: "live", started_at: startedAt, lifecycle_error: null })
        .eq("id", id);
      if (updateError) throw new ApiError("STREAM_UPDATE_FAILED", "Unable to mark the RTC broadcast live", 500, undefined, false);
      return { data: { id, status: "live", startedAt } };
    }

    if (action === "stop") {
      if (["ended", "cancelled", "archived"].includes(stream.status)) return { data: { id, status: stream.status } };
      await adapter.stopBroadcast(loaded.provider, stream.provider_broadcast_id);
      const endedAt = new Date().toISOString();
      const { error: updateError } = await admin.from("live_streams").update({ status: "ended", ended_at: endedAt }).eq("id", id);
      if (updateError) throw new ApiError("STREAM_UPDATE_FAILED", "Provider stopped but stream state could not be finalized", 500, undefined, false);
      return { data: { id, status: "ended", endedAt } };
    }

    if (action === "refresh_status") {
      if (loaded.provider.providerCode === "agora") {
        // Agora RTC channels are ephemeral; COT owns the ready/live/ended
        // lifecycle through host join/leave actions instead of provider polling.
        return { data: { id, status: stream.status } };
      }
      const status = await adapter.getStreamStatus(loaded.provider, stream.provider_broadcast_id);
      const { error: updateError } = await admin.from("live_streams").update({ status }).eq("id", id);
      if (updateError) throw new ApiError("STREAM_UPDATE_FAILED", "Unable to persist provider stream status", 500, undefined, false);
      return { data: { id, status } };
    }

    throw new ApiError("VALIDATION_FAILED", "Unsupported broadcast action", 422);
  },
));
