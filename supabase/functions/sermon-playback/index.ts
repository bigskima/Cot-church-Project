import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient, publicClient } from "../_shared/supabase.ts";
import { loadStreamingConfig } from "../_shared/streaming/configuration.ts";
import { streamingProvider } from "../_shared/streaming/registry.ts";
import { uuid } from "../_shared/validation.ts";

const PLAYBACK_TTL_SECONDS = 15 * 60;

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "optional", organization: "optional" },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const sermonId = uuid(url.searchParams.get("id"), "id", true)!;
    const organizationId = auth?.organizationId ?? uuid(url.searchParams.get("organizationId"), "organizationId");
    if (!organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Church organization is required", 400);

    const viewer = auth?.client ?? publicClient();
    const { data: sermon, error: sermonError } = await viewer
      .from("sermons")
      .select("id,organization_id,expression_id,recording_id,title,video_url,audio_url,thumbnail_url,duration_seconds,status,visibility")
      .eq("id", sermonId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (sermonError || !sermon) throw new ApiError("SERMON_NOT_FOUND", "Sermon is unavailable", 404);

    if (!sermon.recording_id) {
      return {
        data: {
          ready: Boolean(sermon.video_url || sermon.audio_url),
          sermonId: sermon.id,
          source: "direct",
          videoUrl: sermon.video_url ?? null,
          audioUrl: sermon.audio_url ?? null,
          posterUrl: sermon.thumbnail_url ?? null,
          durationSeconds: sermon.duration_seconds ?? null,
          expiresAt: null,
        },
      };
    }

    const admin = adminClient();
    const { data: recording, error: recordingError } = await admin
      .from("live_recordings")
      .select("id,organization_id,stream_id,playback_id,status,duration_seconds,audio_only_url,live_streams!inner(id,organization_id,branch_id,provider_config_id,provider_metadata,thumbnail_url)")
      .eq("id", sermon.recording_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (recordingError || !recording) throw new ApiError("SERMON_RECORDING_NOT_FOUND", "The sermon recording is unavailable", 404);

    const stream = recording.live_streams as unknown as {
      id: string;
      organization_id: string;
      branch_id: string | null;
      provider_config_id: string | null;
      provider_metadata?: Record<string, unknown> | null;
      thumbnail_url?: string | null;
    };
    if (stream.organization_id !== sermon.organization_id) throw new ApiError("SERMON_RECORDING_SCOPE_INVALID", "Recording scope is invalid", 409);
    if (sermon.expression_id && stream.branch_id !== sermon.expression_id) throw new ApiError("SERMON_RECORDING_SCOPE_INVALID", "Recording belongs to another Expression", 409);

    if (recording.status !== "ready") {
      return {
        data: {
          ready: false,
          sermonId: sermon.id,
          recordingId: recording.id,
          source: "livestream_recording",
          status: recording.status,
          videoUrl: null,
          audioUrl: null,
          posterUrl: sermon.thumbnail_url ?? stream.thumbnail_url ?? null,
          durationSeconds: sermon.duration_seconds ?? recording.duration_seconds ?? null,
          expiresAt: null,
        },
      };
    }

    if (!stream.provider_config_id) throw new ApiError("STREAMING_NOT_CONFIGURED", "The recording is not linked to a streaming provider", 503);
    const playbackId = recording.playback_id ?? (stream.provider_metadata?.playbackId ? String(stream.provider_metadata.playbackId) : null);
    if (!playbackId) throw new ApiError("SERMON_PLAYBACK_UNAVAILABLE", "The recording does not have a playback asset yet", 503);

    const loaded = await loadStreamingConfig(stream.provider_config_id);
    if (loaded.organizationId && loaded.organizationId !== sermon.organization_id) {
      throw new ApiError("PROVIDER_SCOPE_DENIED", "Streaming provider configuration is outside this church", 403);
    }
    if (sermon.visibility !== "public" && !loaded.provider.signingKeyReference) {
      throw new ApiError("STREAMING_SIGNING_NOT_CONFIGURED", "Private sermon playback requires a configured signing key", 503);
    }

    const grant = await streamingProvider(loaded.provider.providerCode).createPlaybackToken(
      loaded.provider,
      playbackId,
      PLAYBACK_TTL_SECONDS,
    );

    return {
      data: {
        ready: true,
        sermonId: sermon.id,
        recordingId: recording.id,
        streamId: stream.id,
        source: "livestream_recording",
        provider: loaded.provider.providerCode,
        videoUrl: grant.url,
        audioUrl: sermon.visibility === "public" ? recording.audio_only_url ?? sermon.audio_url ?? null : sermon.audio_url ?? null,
        posterUrl: sermon.thumbnail_url ?? stream.thumbnail_url ?? null,
        durationSeconds: sermon.duration_seconds ?? recording.duration_seconds ?? null,
        expiresAt: grant.expiresAt,
      },
      headers: { "Cache-Control": "private, no-store" },
    };
  },
));
