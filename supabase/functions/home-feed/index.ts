import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient, publicClient, userClient } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validation.ts";
import { diversifyFeed, rankFeedCandidates, type FeedSignals } from "../_shared/feed-ranking.ts";
import { enrichContentCreators } from "../_shared/public-identity.ts";

function nestedItem(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function inSelectedExperience(row: any, selectedExpressionId: string | null, key: string) {
  if (!selectedExpressionId) return true;
  const value = key === "content_items" ? nestedItem(row.content_items)?.expression_id : row[key];
  return value === selectedExpressionId;
}

function emptySignals(): FeedSignals {
  return {
    followedOrganizationIds: new Set(), followedExpressionIds: new Set(), followedLeaderProfileIds: new Set(),
    reactedContentIds: new Set(), bookmarkedContentIds: new Set(), completedContentIds: new Set(), inProgressContentIds: new Set(),
  };
}

function resultData<T>(result: { data: T | null; error: any }, name: string, degraded: string[]) {
  if (result.error) {
    degraded.push(name);
    return [] as unknown as T;
  }
  return (result.data ?? []) as T;
}

function optionalBearer(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiError("INVALID_SESSION", "Session is invalid or expired", 401);
  return match[1];
}

Deno.serve(createHandler(
  // Home deliberately owns optional identity resolution instead of using the generic
  // auth helper. General Community is public and must remain available to a signed-in
  // account that has not joined an Expression yet. Expression mode is validated below.
  { methods: ["GET"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const url = new URL(request.url);
    const requestedOrganizationId = url.searchParams.get("organizationId");
    const requestedExpressionId = url.searchParams.get("expressionId");
    const admin = adminClient();

    const token = optionalBearer(request);
    let authenticatedClient: ReturnType<typeof userClient> | null = null;
    let userId: string | null = null;
    if (token) {
      authenticatedClient = userClient(token);
      const { data: userData, error: userError } = await authenticatedClient.auth.getUser(token);
      if (userError || !userData.user) throw new ApiError("INVALID_SESSION", "Session is invalid or expired", 401);
      userId = userData.user.id;
    }

    let organizationId = requestedOrganizationId
      ? uuid(requestedOrganizationId, "organizationId", true)!
      : null;

    if (!organizationId) {
      const { data, error } = await admin
        .from("organizations")
        .select("id")
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(2);
      if (error) throw new ApiError("HOME_ORGANIZATION_FAILED", "Unable to resolve the church home feed", 500, undefined, false);
      if ((data ?? []).length !== 1) throw new ApiError("ORGANIZATION_REQUIRED", "Choose a church to view its home feed", 422);
      organizationId = data![0].id;
    }

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("id,name,slug,status")
      .eq("id", organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (organizationError || !organization) throw new ApiError("ORGANIZATION_NOT_FOUND", "This church is not available", 404);

    const selectedExpressionId = requestedExpressionId
      ? uuid(requestedExpressionId, "expressionId", true)!
      : null;

    let selectedExpression: { id: string; name: string } | null = null;
    if (selectedExpressionId) {
      if (!userId || !authenticatedClient) {
        throw new ApiError("EXPRESSION_ACCESS_DENIED", "Sign in and join this Expression to view its member feed", 403);
      }

      const { data: exactMembership, error: membershipError } = await admin
        .from("expression_memberships")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("profile_id", userId)
        .eq("branch_id", selectedExpressionId)
        .eq("status", "active")
        .maybeSingle();
      if (membershipError || !exactMembership) {
        throw new ApiError("EXPRESSION_ACCESS_DENIED", "Your account is not an active member of this Expression", 403);
      }

      const { data: branch, error: branchError } = await admin
        .from("branches")
        .select("id,name,is_active")
        .eq("id", selectedExpressionId)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .maybeSingle();
      if (branchError || !branch) throw new ApiError("EXPRESSION_NOT_FOUND", "This Expression is unavailable", 404);
      selectedExpression = { id: branch.id, name: branch.name };
    }

    // General mode deliberately uses the anonymous client even when a valid session is
    // present, so it can never leak member-only rows. Expression mode uses the caller's
    // JWT, with the exact membership check above and RLS remaining authoritative.
    const client = selectedExpressionId ? authenticatedClient! : publicClient();
    const degraded: string[] = [];
    const recentEventCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [streamsResult, reelsResult, videosResult, sermonsResult, eventsResult] = await Promise.all([
      client
        .from("live_streams")
        .select("id,organization_id,branch_id,title,description,status,visibility,scheduled_start,started_at,ended_at,recording_url,thumbnail_url,viewer_count,playback_url,playback_token_required,created_at")
        .eq("organization_id", organizationId)
        .in("status", ["scheduled", "live", "ended"])
        .order("scheduled_start", { ascending: false, nullsFirst: false })
        .limit(30),
      client
        .from("reels")
        .select("id,organization_id,media_asset_id,caption,audio_title,audio_artist,views_count,likes_count,comments_count,shares_count,created_at,content_items!inner(id,organization_id,expression_id,author_profile_id,visibility,status,published_at),media_assets(id,media_type,processing_state,duration_seconds,aspect_ratio,media_renditions(id,rendition_kind,container,codec,width,height,storage_path,provider_playback_id),media_thumbnails(storage_path,is_primary))")
        .eq("organization_id", organizationId)
        .eq("content_items.status", "published")
        .order("created_at", { ascending: false })
        .limit(40),
      client
        .from("videos")
        .select("id,organization_id,media_asset_id,series_id,title,slug,description,category,chapters,transcript,views_count,likes_count,comments_count,shares_count,created_at,content_items!inner(id,organization_id,expression_id,author_profile_id,visibility,status,published_at),media_assets(id,media_type,processing_state,duration_seconds,aspect_ratio,media_renditions(id,rendition_kind,container,codec,width,height,storage_path,provider_playback_id),media_thumbnails(storage_path,is_primary))")
        .eq("organization_id", organizationId)
        .eq("content_items.status", "published")
        .order("created_at", { ascending: false })
        .limit(40),
      client
        .from("sermons")
        .select("id,organization_id,expression_id,content_item_id,series_id,title,slug,preacher,sermon_date,scripture_references,topics,description,transcript,audio_url,video_url,thumbnail_url,audio_asset_id,video_asset_id,chapters,duration_seconds,status,visibility,is_featured,play_count,published_at,created_at")
        .eq("organization_id", organizationId)
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(50),
      client
        .from("events")
        .select("id,organization_id,branch_id,title,description,starts_at,ends_at,location,capacity,visibility,created_at")
        .eq("organization_id", organizationId)
        .gte("ends_at", recentEventCutoff)
        .order("starts_at", { ascending: true })
        .limit(30),

    ]);

    const streams = resultData<any[]>(streamsResult as any, "live", degraded)
      .filter((row) => inSelectedExperience(row, selectedExpressionId, "branch_id"))
      .map((stream) => ({
        ...stream,
        playback_url: stream.playback_token_required ? null : stream.playback_url,
        recording_url: stream.playback_token_required ? null : stream.recording_url,
      }));
    let reels = resultData<any[]>(reelsResult as any, "reels", degraded)
      .filter((row) => inSelectedExperience(row, selectedExpressionId, "content_items"));
    let videos = resultData<any[]>(videosResult as any, "videos", degraded)
      .filter((row) => inSelectedExperience(row, selectedExpressionId, "content_items"));
    [reels, videos] = await Promise.all([
      enrichContentCreators(reels),
      enrichContentCreators(videos),
    ]);
    const sermons = resultData<any[]>(sermonsResult as any, "sermons", degraded)
      .filter((row) => inSelectedExperience(row, selectedExpressionId, "expression_id"));
    const events = resultData<any[]>(eventsResult as any, "events", degraded)
      .filter((row) => inSelectedExperience(row, selectedExpressionId, "branch_id"));
    let rankingMode: "personalized" | "recent" | "expression" = selectedExpressionId ? "expression" : "recent";
    if (!selectedExpressionId && userId) {
      const signals = emptySignals();
      const [followsResult, reactionsResult, bookmarksResult, progressResult] = await Promise.all([
        admin.from("follows").select("organization_id,expression_id,leader:leaders(profile_id)").eq("profile_id", userId),
        admin.from("content_reactions").select("content_item_id").eq("profile_id", userId).limit(500),
        admin.from("content_bookmarks").select("content_item_id").eq("profile_id", userId).limit(500),
        admin.from("content_playback_progress").select("content_item_id,completed,progress_seconds").eq("profile_id", userId).limit(500),
      ]);
      if (!followsResult.error && !reactionsResult.error && !bookmarksResult.error && !progressResult.error) {
        for (const follow of followsResult.data ?? []) {
          if (follow.organization_id) signals.followedOrganizationIds.add(follow.organization_id);
          if (follow.expression_id) signals.followedExpressionIds.add(follow.expression_id);
          const leader = nestedItem(follow.leader);
          if (leader?.profile_id) signals.followedLeaderProfileIds.add(leader.profile_id);
        }
        for (const row of reactionsResult.data ?? []) signals.reactedContentIds.add(row.content_item_id);
        for (const row of bookmarksResult.data ?? []) signals.bookmarkedContentIds.add(row.content_item_id);
        for (const row of progressResult.data ?? []) {
          if (row.completed) signals.completedContentIds.add(row.content_item_id);
          else if (row.progress_seconds > 0) signals.inProgressContentIds.add(row.content_item_id);
        }

        const candidates = [
          ...reels.map((row: any) => { const item = nestedItem(row.content_items); return { key: `reel:${row.id}`, kind: "reel" as const, publishedAt: item?.published_at ?? row.created_at, expressionId: item?.expression_id, authorProfileId: item?.author_profile_id, contentItemId: item?.id, engagementCount: row.likes_count + row.comments_count + row.shares_count }; }),
          ...videos.map((row: any) => { const item = nestedItem(row.content_items); return { key: `video:${row.id}`, kind: "video" as const, publishedAt: item?.published_at ?? row.created_at, expressionId: item?.expression_id, authorProfileId: item?.author_profile_id, contentItemId: item?.id, engagementCount: row.likes_count + row.comments_count + row.shares_count }; }),
          ...sermons.map((row: any) => ({ key: `sermon:${row.id}`, kind: "sermon" as const, publishedAt: row.published_at ?? row.sermon_date, expressionId: row.expression_id, contentItemId: row.content_item_id, engagementCount: row.play_count })),
          ...events.map((row: any) => ({ key: `event:${row.id}`, kind: "event" as const, publishedAt: row.created_at ?? row.starts_at, expressionId: row.branch_id })),
        ];
        const ranked = diversifyFeed(rankFeedCandidates(candidates, organization.id, signals));
        const ranking = new Map(ranked.map((item, index) => [item.key, { feed_rank: ranked.length - index, feed_reason: item.reason }]));
        reels.forEach((row: any) => Object.assign(row, ranking.get(`reel:${row.id}`)));
        videos.forEach((row: any) => Object.assign(row, ranking.get(`video:${row.id}`)));
        sermons.forEach((row: any) => Object.assign(row, ranking.get(`sermon:${row.id}`)));
        events.forEach((row: any) => Object.assign(row, ranking.get(`event:${row.id}`)));
        rankingMode = "personalized";
      } else {
        degraded.push("personalization");
      }
    }

    if (["live", "reels", "videos", "sermons", "events"].every((section) => degraded.includes(section))) {
      throw new ApiError("HOME_FEED_FAILED", "Home content is temporarily unavailable", 503, undefined, true);
    }

    return {
      data: {
        organization: { id: organization.id, name: organization.name, slug: organization.slug },
        expression: selectedExpression,
        mode: selectedExpressionId ? "expression" : "general",
        streams,
        reels,
        videos,
        sermons,
        events,
        rankingMode,
        degradedSections: degraded,
      },
    };
  },
));
