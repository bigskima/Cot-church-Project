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

const cache = new Map<string, { expiresAt: number; value: unknown }>();

async function resolveOrganizationId(raw?: string | null) {
  const admin = adminClient();
  if (raw) {
    const id = uuid(raw, "organizationId", true)!;
    const { data, error } = await admin.from("organizations").select("id,status").eq("id", id).eq("status", "active").maybeSingle();
    if (error || !data) throw new ApiError("ORGANIZATION_NOT_FOUND", "This church community is unavailable", 404);
    return id;
  }
  const { data, error } = await admin.from("organizations").select("id").eq("status", "active").order("created_at", { ascending: true }).limit(2);
  if (error) throw new ApiError("ORGANIZATION_LOOKUP_FAILED", "Unable to resolve the church community", 500, undefined, false);
  if ((data ?? []).length === 1) return data![0].id;
  throw new ApiError("ORGANIZATION_REQUIRED", "Choose a church to view its live service", 422);
}

function thumbnail(snippet?: YouTubeSearchItem["snippet"]) {
  const thumbnails = snippet?.thumbnails ?? {};
  return thumbnails.maxres?.url ?? thumbnails.standard?.url ?? thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null;
}

async function youtubeJson(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = await response.json();
    if (!response.ok) {
      throw new ApiError("YOUTUBE_API_ERROR", payload?.error?.message ?? `YouTube returned ${response.status}`, 502, undefined, false);
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

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const url = new URL(request.url);
    const organizationId = await resolveOrganizationId(url.searchParams.get("organizationId"));
    const loaded = await defaultStreamingConfig(organizationId, "general");
    if (loaded.provider.providerCode !== "youtube") {
      return { data: { providerCode: loaded.provider.providerCode, stream: null } };
    }

    const channelId = typeof loaded.provider.settings.channelId === "string" ? loaded.provider.settings.channelId.trim() : "";
    if (!channelId) throw new ApiError("YOUTUBE_CHANNEL_NOT_CONFIGURED", "General COT YouTube channel is not configured", 503);

    const apiKey = await resolveSecretValue(loaded.provider.secretReference);
    const requestedId = url.searchParams.get("videoId")?.trim() || "";
    const cacheKey = requestedId ? `${channelId}:video:${requestedId}` : `${channelId}:current`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { data: cached.value };

    let stream: ReturnType<typeof asStream> | null = null;

    if (requestedId) {
      const item = await videoDetails(apiKey, requestedId);
      if (!item || item.snippet?.channelId !== channelId || item.status?.embeddable === false) {
        throw new ApiError("YOUTUBE_BROADCAST_NOT_FOUND", "This YouTube broadcast is not available from the configured General COT channel", 404);
      }
      const live = Boolean(item.liveStreamingDetails?.actualStartTime && !item.liveStreamingDetails?.actualEndTime);
      stream = asStream(item, live ? "live" : "scheduled");
    } else {
      const liveSearch = await searchChannel(apiKey, channelId, "live");
      if (liveSearch?.id?.videoId) {
        const item = await videoDetails(apiKey, liveSearch.id.videoId);
        if (item) stream = asStream(item, "live");
      }
      if (!stream && loaded.provider.settings.includeUpcoming !== false) {
        const upcomingSearch = await searchChannel(apiKey, channelId, "upcoming");
        if (upcomingSearch?.id?.videoId) {
          const item = await videoDetails(apiKey, upcomingSearch.id.videoId);
          if (item) stream = asStream(item, "scheduled");
        }
      }
    }

    const value = {
      providerCode: "youtube",
      channelId,
      stream,
      sourceMode: "external_channel",
      refreshedAt: new Date().toISOString(),
    };
    cache.set(cacheKey, { expiresAt: Date.now() + 60_000, value });
    return { data: value, headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } };
  },
));
