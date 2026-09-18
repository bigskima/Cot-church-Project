import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";
import { loadStreamingConfig } from "../_shared/streaming/configuration.ts";
import { streamingProvider } from "../_shared/streaming/registry.ts";
import { uuid } from "../_shared/validation.ts";
import { resolveGeneralYouTubeVideo, resolveSingleActiveOrganizationId } from "../_shared/youtube-live.ts";

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function rtcSessionUid() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  const value = values[0] & 0x7fffffff;
  return value === 0 ? 1 : value;
}

Deno.serve(createHandler(
  { methods: ["POST"], authentication: "optional", organization: "optional" },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const rawId = url.searchParams.get("id") ?? "";
    const admin = adminClient();

    if (rawId.startsWith("youtube_")) {
      const requestedOrganizationId = url.searchParams.get("organizationId");
      const organizationId = requestedOrganizationId
        ? uuid(requestedOrganizationId, "organizationId", true)!
        : await resolveSingleActiveOrganizationId();
      const external = await resolveGeneralYouTubeVideo(organizationId, rawId.slice("youtube_".length));

      const { data: givingSettings } = await admin
        .from("giving_settings")
        .select("is_enabled")
        .eq("organization_id", organizationId)
        .is("branch_id", null)
        .maybeSingle();

      return {
        data: {
          stream: external,
          playbackUrl: null,
          playbackExpiresAt: null,
          viewerSessionId: null,
          rtcGrant: null,
          canChat: false,
          givingEnabled: givingSettings?.is_enabled === true,
        },
      };
    }

    const id = uuid(rawId, "id", true)!;

    const { data: stream, error } = await admin
      .from("live_streams")
      .select("id,organization_id,branch_id,title,description,status,visibility,provider,provider_config_id,provider_broadcast_id,provider_metadata,playback_url,recording_url,playback_token_required,scheduled_start,started_at,ended_at")
      .eq("id", id)
      .single();
    if (error || !stream) throw new ApiError("STREAM_NOT_FOUND", "Broadcast not found", 404);

    const { data: organization } = await admin
      .from("organizations")
      .select("status")
      .eq("id", stream.organization_id)
      .maybeSingle();
    if (organization?.status !== "active") {
      throw new ApiError("STREAM_NOT_FOUND", "Broadcast not found", 404);
    }

    if (!["scheduled", "provisioning", "ready", "live", "ended", "processing", "replay_ready", "failed"].includes(stream.status)) {
      throw new ApiError("STREAM_NOT_FOUND", "Broadcast not found", 404);
    }

    if (auth) {
      const { data: allowed, error: accessError } = await auth.client.rpc("can_access_stream", {
        target_stream_id: id,
      });
      if (accessError || !allowed) {
        throw new ApiError("STREAM_ACCESS_DENIED", "You do not have access to this broadcast", 403);
      }
    } else if (stream.visibility !== "public") {
      throw new ApiError("AUTHENTICATION_REQUIRED", "Sign in to access this broadcast", 401);
    }

    let rtcGrant: unknown = null;
    if (stream.provider === "agora" && stream.status === "live") {
      if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Sign in to watch this Expression broadcast", 401);
      if (!stream.provider_config_id || !stream.provider_broadcast_id) {
        throw new ApiError("STREAM_PROVIDER_STATE_INVALID", "Broadcast is missing its RTC provider session", 409);
      }
      const loaded = await loadStreamingConfig(stream.provider_config_id);
      if (loaded.provider.providerCode !== "agora") {
        throw new ApiError("STREAMING_PLAYBACK_MODE_INVALID", "This broadcast does not use Agora RTC", 409);
      }
      if (loaded.provider.settings?.cohostAuthenticationEnabled !== true) {
        throw new ApiError(
          "AGORA_COHOST_AUTH_REQUIRED",
          "Expression live is unavailable until Agora Co-host token authentication is confirmed",
          503,
          undefined,
          false,
        );
      }
      const adapter = streamingProvider("agora");
      if (!adapter.createRtcGrant) {
        throw new ApiError("STREAMING_ADAPTER_UNAVAILABLE", "Agora RTC grant support is unavailable", 500, undefined, false);
      }
      const ttlSetting = Number(loaded.provider.settings?.tokenTtlSeconds ?? 3600);
      const ttlSeconds = Number.isFinite(ttlSetting) ? Math.max(300, Math.min(86400, Math.floor(ttlSetting))) : 3600;
      rtcGrant = await adapter.createRtcGrant(
        loaded.provider,
        stream.provider_broadcast_id,
        rtcSessionUid(),
        "subscriber",
        ttlSeconds,
      );
    }

    const playbackEligible = ["live", "ended", "processing", "replay_ready"].includes(stream.status);
    let playbackUrl = playbackEligible
      ? (stream.status === "live" ? stream.playback_url : stream.recording_url)
      : null;
    let expiresAt: string | null = null;

    if (playbackEligible && stream.provider === "agora") {
      // Agora playback is authorized in this same access response through rtcGrant.
      // Do not force an HLS URL or signed-playback grant for RTC broadcasts.
      playbackUrl = null;
    } else if (playbackEligible && stream.provider_config_id && stream.provider_metadata?.playbackId) {
      const loaded = await loadStreamingConfig(stream.provider_config_id);
      const grant = await streamingProvider(loaded.provider.providerCode).createPlaybackToken(
        loaded.provider,
        String(stream.provider_metadata.playbackId),
        300,
        stream.playback_token_required ? "signed" : "public",
      );
      playbackUrl = grant.url;
      expiresAt = grant.expiresAt;
    } else if (playbackEligible && stream.playback_token_required && !playbackUrl) {
      // Never fall back to exposing a raw provider URL when the stream is
      // configured to require signed playback.
      throw new ApiError(
        "PLAYBACK_UNAVAILABLE",
        "Secure playback is temporarily unavailable for this broadcast",
        503,
        undefined,
        false,
      );
    }

    if (playbackUrl) {
      const grantExpiry = expiresAt ?? new Date(Date.now() + 300_000).toISOString();
      const nonce = crypto.randomUUID();
      const ip = request.headers.get("x-forwarded-for") ?? "unknown";
      const userAgent = request.headers.get("user-agent") ?? "unknown";
      const anonymousSessionHash = auth
        ? null
        : await hash(`public-stream:${id}:${nonce}:${ip}:${userAgent}`);

      const { error: grantError } = await admin.from("live_access_grants").insert({
        organization_id: stream.organization_id,
        stream_id: id,
        profile_id: auth?.user.id ?? null,
        anonymous_session_hash: anonymousSessionHash,
        token_jti_hash: await hash(nonce),
        expires_at: grantExpiry,
        ip_hash: await hash(ip),
        user_agent_hash: await hash(userAgent),
      });
      if (grantError) {
        throw new ApiError("PLAYBACK_GRANT_FAILED", "Unable to authorize playback", 503, undefined, false);
      }
      expiresAt = grantExpiry;
    }

    let viewerSessionId: string | null = null;
    if (auth && stream.status === "live") {
      const { data: session } = await admin
        .from("stream_viewer_sessions")
        .insert({
          stream_id: id,
          organization_id: stream.organization_id,
          profile_id: auth.user.id,
        })
        .select("id")
        .single();
      viewerSessionId = session?.id ?? null;
    }

    let hasActiveMembership = false;
    if (auth) {
      const { data: membership } = await admin
        .from("memberships")
        .select("id")
        .eq("organization_id", stream.organization_id)
        .eq("profile_id", auth.user.id)
        .eq("status", "active")
        .maybeSingle();
      hasActiveMembership = Boolean(membership);
    }

    let givingQuery = admin
      .from("giving_settings")
      .select("is_enabled")
      .eq("organization_id", stream.organization_id);
    givingQuery = stream.branch_id
      ? givingQuery.eq("branch_id", stream.branch_id)
      : givingQuery.is("branch_id", null);
    const { data: givingSettings } = await givingQuery.maybeSingle();
    const givingEnabled = givingSettings?.is_enabled === true;

    return {
      data: {
        stream: {
          id: stream.id,
          title: stream.title,
          description: stream.description,
          status: stream.status,
          visibility: stream.visibility,
          provider: stream.provider,
          playback_kind: stream.provider === "agora" ? "agora" : "hls",
          branch_id: stream.branch_id,
          expression_id: stream.branch_id,
          scheduled_start: stream.scheduled_start,
          started_at: stream.started_at,
          ended_at: stream.ended_at,
        },
        playbackUrl,
        playbackExpiresAt: expiresAt,
        viewerSessionId,
        rtcGrant,
        canChat: Boolean(auth) && stream.status === "live" && hasActiveMembership,
        givingEnabled,
      },
    };
  },
));
