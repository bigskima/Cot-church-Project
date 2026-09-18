import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";
import { resolveSecretValue } from "../_shared/secrets.ts";
import { defaultStreamingConfig } from "../_shared/streaming/configuration.ts";
import { uuid } from "../_shared/validation.ts";

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
};

type YouTubeVideoItem = {
  id?: string;
  snippet?: YouTubeSearchItem["snippet"];
  liveStreamingDetails?: {
    actualStartTime?: string;
    actualEndTime?: string;
    scheduledStartTime?: string;
    concurrentViewers?: string;
  };
  status?: { embeddable?: boolean; privacyStatus?: string };
};

type GeneralLiveValue = {
  providerCode: "youtube";
  channelId: string;
  stream: ReturnType<typeof asStream> | null;
  sourceMode: string;
  refreshedAt: string;
};

type GeneralLiveCacheRow = {
  provider_config_id: string;
  channel_id: string;
  external_video_id: string | null;
  stream_payload: GeneralLiveValue | Record<string, unknown>;
  expires_at: string | null;
  refresh_claimed_until: string | null;
  last_checked_at: string | null;
  last_error: string | null;
};

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
    if (error || !data) throw new ApiError("ORGANIZATION_NOT_FOUND", "This church community is unavailable", 404);
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
  throw new ApiError("ORGANIZATION_REQUIRED", "Choose a church to view its live service", 422);
}

function thumbnail(snippet?: YouTubeSearchItem["snippet"]) {
  const thumbnails = snippet?.thumbnails ?? {};
  return thumbnails.maxres?.url
    ?? thumbnails.standard?.url
    ?? thumbnails.high?.url
    ?? thumbnails.medium?.url
    ?? thumbnails.default?.url
    ?? null;
}

async function youtubeJson(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = await response.json();
    if (!response.ok) {
      throw new ApiError(
        "YOUTUBE_API_ERROR",
        payload?.error?.message ?? `YouTube returned ${response.status}`,
        502,
        undefined,
        false,
      );
    }
    return payload as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

async function videoDetails(apiKey: string, videoId: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,liveStreamingDetails,status");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);
  const payload = await youtubeJson(url) as { items?: YouTubeVideoItem[] };
  return payload.items?.[0] ?? null;
}

async function searchChannel(apiKey: string, channelId: string, eventType: "live" | "upcoming") {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("eventType", eventType);
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("order", "date");
  url.searchParams.set("key", apiKey);
  const payload = await youtubeJson(url) as { items?: YouTubeSearchItem[] };
  return payload.items?.[0] ?? null;
}

function asStream(item: YouTubeVideoItem, status: "live" | "scheduled") {
  const videoId = item.id!;
  const details = item.liveStreamingDetails ?? {};
  return {
    id: `youtube_${videoId}`,
    external_id: videoId,
    provider: "youtube",
    playback_kind: "youtube",
    title: item.snippet?.title ?? "COT Live",
    description: item.snippet?.description ?? "",
    status,
    visibility: "public",
    thumbnail_url: thumbnail(item.snippet),
    playback_url: `https://www.youtube.com/embed/${videoId}`,
    scheduled_start: details.scheduledStartTime ?? item.snippet?.publishedAt ?? null,
    started_at: details.actualStartTime ?? null,
    ended_at: details.actualEndTime ?? null,
    viewer_count: details.concurrentViewers ? Number(details.concurrentViewers) : undefined,
  };
}

function isGeneralLiveValue(value: unknown): value is GeneralLiveValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.providerCode === "youtube" && typeof record.channelId === "string";
}

function cacheMatches(cache: GeneralLiveCacheRow | null, configId: string, channelId: string) {
  return Boolean(
    cache
      && cache.provider_config_id === configId
      && cache.channel_id === channelId
      && isGeneralLiveValue(cache.stream_payload),
  );
}

function cacheFresh(cache: GeneralLiveCacheRow | null, configId: string, channelId: string) {
  if (!cacheMatches(cache, configId, channelId) || !cache?.expires_at) return false;
  const expiry = new Date(cache.expires_at).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}

async function readCache(organizationId: string) {
  const { data, error } = await adminClient()
    .from("general_live_source_cache")
    .select("provider_config_id,channel_id,external_video_id,stream_payload,expires_at,refresh_claimed_until,last_checked_at,last_error")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) {
    throw new ApiError("LIVE_SOURCE_CACHE_FAILED", "Unable to read the General COT live-source cache", 503, undefined, false);
  }
  return (data ?? null) as GeneralLiveCacheRow | null;
}

async function claimRefresh(organizationId: string, providerConfigId: string, channelId: string) {
  const { data, error } = await adminClient().rpc("claim_general_live_source_refresh", {
    target_organization_id: organizationId,
    target_provider_config_id: providerConfigId,
    target_channel_id: channelId,
    claim_seconds: 20,
  });
  if (error) {
    throw new ApiError("LIVE_SOURCE_CACHE_FAILED", "Unable to reserve a General COT live-source refresh", 503, undefined, false);
  }
  return data === true;
}

async function writeCache(
  organizationId: string,
  providerConfigId: string,
  channelId: string,
  value: GeneralLiveValue,
  ttlSeconds: number,
  errorMessage: string | null = null,
) {
  const { error } = await adminClient().rpc("write_general_live_source_cache", {
    target_organization_id: organizationId,
    target_provider_config_id: providerConfigId,
    target_channel_id: channelId,
    target_external_video_id: value.stream?.external_id ?? null,
    target_stream_payload: value,
    target_ttl_seconds: ttlSeconds,
    target_error: errorMessage,
  });
  if (error) {
    throw new ApiError("LIVE_SOURCE_CACHE_FAILED", "Unable to save the General COT live-source cache", 503, undefined, false);
  }
}

function cacheHeaders(ttlSeconds: number) {
  const browserTtl = Math.max(5, Math.min(60, Math.floor(ttlSeconds / 2)));
  return { "Cache-Control": `public, max-age=${browserTtl}, stale-while-revalidate=${Math.max(30, browserTtl * 2)}` };
}

function itemState(item: YouTubeVideoItem | null): "live" | "scheduled" | "ended" | "unknown" {
  if (!item) return "unknown";
  const details = item.liveStreamingDetails ?? {};
  if (details.actualStartTime && !details.actualEndTime) return "live";
  if (!details.actualStartTime && !details.actualEndTime && details.scheduledStartTime) return "scheduled";
  if (details.actualEndTime) return "ended";
  return "unknown";
}

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = await resolveOrganizationId(url.searchParams.get("organizationId"));
    const loaded = await defaultStreamingConfig(organizationId, "general");

    if (loaded.provider.providerCode !== "youtube") {
      return { data: { providerCode: loaded.provider.providerCode, stream: null } };
    }

    const channelId = typeof loaded.provider.settings.channelId === "string"
      ? loaded.provider.settings.channelId.trim()
      : "";
    if (!channelId) {
      throw new ApiError("YOUTUBE_CHANNEL_NOT_CONFIGURED", "General COT YouTube channel is not configured", 503);
    }

    const requestedId = url.searchParams.get("videoId")?.trim() || "";

    // Opening a known General YouTube broadcast uses the cheap videos.list read
    // and never consumes the limited search.list discovery budget.
    if (requestedId) {
      const apiKey = await resolveSecretValue(loaded.provider.secretReference);
      const item = await videoDetails(apiKey, requestedId);
      if (!item || item.snippet?.channelId !== channelId || item.status?.embeddable === false) {
        throw new ApiError(
          "YOUTUBE_BROADCAST_NOT_FOUND",
          "This YouTube broadcast is not available from the configured General COT channel",
          404,
        );
      }
      const state = itemState(item);
      if (state === "ended" || state === "unknown") {
        throw new ApiError("YOUTUBE_BROADCAST_NOT_FOUND", "This YouTube live service is no longer available", 404);
      }
      return {
        data: {
          providerCode: "youtube",
          channelId,
          stream: asStream(item, state),
          sourceMode: "direct_video",
          refreshedAt: new Date().toISOString(),
        },
        headers: cacheHeaders(60),
      };
    }

    const cached = await readCache(organizationId);
    if (cacheFresh(cached, loaded.id, channelId) && isGeneralLiveValue(cached!.stream_payload)) {
      return { data: cached!.stream_payload, headers: cacheHeaders(60) };
    }

    const claimed = await claimRefresh(organizationId, loaded.id, channelId);
    if (!claimed) {
      if (cacheMatches(cached, loaded.id, channelId) && isGeneralLiveValue(cached!.stream_payload)) {
        return {
          data: {
            ...cached!.stream_payload,
            sourceMode: "cache_stale_refreshing",
          },
          headers: cacheHeaders(15),
        };
      }
      return {
        data: {
          providerCode: "youtube",
          channelId,
          stream: null,
          sourceMode: "refreshing",
          refreshedAt: new Date().toISOString(),
        },
        headers: cacheHeaders(10),
      };
    }

    const apiKey = await resolveSecretValue(loaded.provider.secretReference);
    let stream: ReturnType<typeof asStream> | null = null;

    try {
      // Once a video is known, use videos.list to track scheduled -> live -> ended.
      // This avoids spending search quota every minute during a service.
      if (cacheMatches(cached, loaded.id, channelId) && cached?.external_video_id) {
        const known = await videoDetails(apiKey, cached.external_video_id);
        if (known && known.snippet?.channelId === channelId && known.status?.embeddable !== false) {
          const state = itemState(known);
          if (state === "live" || state === "scheduled") stream = asStream(known, state);
        }
      }

      // Search is reserved for discovery when no usable known broadcast exists.
      if (!stream) {
        const liveSearch = await searchChannel(apiKey, channelId, "live");
        if (liveSearch?.id?.videoId) {
          const item = await videoDetails(apiKey, liveSearch.id.videoId);
          if (item && item.snippet?.channelId === channelId && item.status?.embeddable !== false) {
            stream = asStream(item, "live");
          }
        }
      }

      if (!stream && loaded.provider.settings.includeUpcoming !== false) {
        const upcomingSearch = await searchChannel(apiKey, channelId, "upcoming");
        if (upcomingSearch?.id?.videoId) {
          const item = await videoDetails(apiKey, upcomingSearch.id.videoId);
          if (item && item.snippet?.channelId === channelId && item.status?.embeddable !== false) {
            stream = asStream(item, "scheduled");
          }
        }
      }

      const ttlSeconds = stream?.status === "live" ? 60 : stream?.status === "scheduled" ? 300 : 1800;
      const value: GeneralLiveValue = {
        providerCode: "youtube",
        channelId,
        stream,
        sourceMode: stream ? "external_channel" : "external_channel_idle",
        refreshedAt: new Date().toISOString(),
      };

      await writeCache(organizationId, loaded.id, channelId, value, ttlSeconds);
      return { data: value, headers: cacheHeaders(ttlSeconds) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "YouTube live-source refresh failed";
      if (cacheMatches(cached, loaded.id, channelId) && isGeneralLiveValue(cached!.stream_payload)) {
        const stale: GeneralLiveValue = {
          ...cached!.stream_payload,
          sourceMode: "cache_stale_after_provider_error",
          refreshedAt: cached!.last_checked_at ?? new Date().toISOString(),
        };
        await writeCache(organizationId, loaded.id, channelId, stale, 120, errorMessage);
        return { data: stale, headers: cacheHeaders(30) };
      }

      const unavailable: GeneralLiveValue = {
        providerCode: "youtube",
        channelId,
        stream: null,
        sourceMode: "provider_error",
        refreshedAt: new Date().toISOString(),
      };
      await writeCache(organizationId, loaded.id, channelId, unavailable, 120, errorMessage);
      throw error;
    }
  },
));
