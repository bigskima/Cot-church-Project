import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";
import { loadStreamingConfig } from "../_shared/streaming/configuration.ts";
import { streamingProvider } from "../_shared/streaming/registry.ts";
import { uuid } from "../_shared/validation.ts";

async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(createHandler(
  { methods: ["POST"], authentication: "required", organization: "optional" },
  async ({ request, auth }) => {
    const id = uuid(new URL(request.url).searchParams.get("id"), "id", true)!;
    const { data: allowed, error: accessError } = await auth!.client.rpc("can_access_stream", {
      target_stream_id: id,
    });
    if (accessError || !allowed) {
      throw new ApiError("STREAM_ACCESS_DENIED", "You do not have access to this broadcast", 403);
    }

    const admin = adminClient();
    const { data: stream, error } = await admin
      .from("live_streams")
      .select("id,organization_id,title,description,status,visibility,provider_config_id,provider_metadata,playback_url,recording_url")
      .eq("id", id)
      .single();
    if (error || !stream) throw new ApiError("STREAM_NOT_FOUND", "Broadcast not found", 404);

    let playbackUrl =
      stream.status === "ended" || stream.status === "replay_ready"
        ? stream.recording_url
        : stream.playback_url;
    let expiresAt = new Date(Date.now() + 300_000).toISOString();

    if (stream.provider_config_id && stream.provider_metadata?.playbackId) {
      const loaded = await loadStreamingConfig(stream.provider_config_id);
      const grant = await streamingProvider(loaded.provider.providerCode).createPlaybackToken(
        loaded.provider,
        String(stream.provider_metadata.playbackId),
        300,
      );
      playbackUrl = grant.url;
      expiresAt = grant.expiresAt;
    }

    const nonce = crypto.randomUUID();
    await admin.from("live_access_grants").insert({
      organization_id: stream.organization_id,
      stream_id: id,
      profile_id: auth!.user.id,
      token_jti_hash: await hash(nonce),
      expires_at: expiresAt,
      ip_hash: await hash(request.headers.get("x-forwarded-for") ?? "unknown"),
      user_agent_hash: await hash(request.headers.get("user-agent") ?? "unknown"),
    });

    let viewerSessionId: string | null = null;
    if (stream.status === "live") {
      const { data: session } = await admin
        .from("stream_viewer_sessions")
        .insert({
          stream_id: id,
          organization_id: stream.organization_id,
          profile_id: auth!.user.id,
        })
        .select("id")
        .single();
      viewerSessionId = session?.id ?? null;
    }

    const { data: membership } = await admin
      .from("memberships")
      .select("id")
      .eq("organization_id", stream.organization_id)
      .eq("profile_id", auth!.user.id)
      .eq("status", "active")
      .maybeSingle();

    return {
      data: {
        stream: {
          id: stream.id,
          title: stream.title,
          description: stream.description,
          status: stream.status,
          visibility: stream.visibility,
        },
        playbackUrl,
        playbackExpiresAt: expiresAt,
        viewerSessionId,
        // Chat storage requires an active organization membership even when
        // the stream itself is publicly viewable.
        canChat: stream.status === "live" && Boolean(membership),
        givingEnabled: true,
      },
    };
  },
));
