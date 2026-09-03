import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { enrichSocialPosts } from "../_shared/public-identity.ts";
import { adminClient, publicClient } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validation.ts";

function nestedItem(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function inSelectedExperience(row: any, selectedExpressionId: string | null, key: string) {
  if (!selectedExpressionId) return true;
  const value = key === "content_items" ? nestedItem(row.content_items)?.expression_id : row[key];
  return value == null || value === selectedExpressionId;
}

function resultData<T>(result: { data: T | null; error: any }, name: string, degraded: string[]) {
  if (result.error) {
    degraded.push(name);
    return [] as unknown as T;
  }
  return (result.data ?? []) as T;
}

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "optional", organization: "optional" },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const requestedOrganizationId = url.searchParams.get("organizationId");
    const requestedExpressionId = url.searchParams.get("expressionId");
    const admin = adminClient();

    let organizationId = requestedOrganizationId
      ? uuid(requestedOrganizationId, "organizationId", true)!
      : auth?.organizationId ?? null;

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
      : auth?.branchId ?? null;

    let selectedExpression: { id: string; name: string } | null = null;
    if (selectedExpressionId) {
      if (!auth?.user || !auth.client) throw new ApiError("EXPRESSION_ACCESS_DENIED", "Sign in and join this Expression to view its member feed", 403);

      const { data: exactMembership, error: membershipError } = await admin
        .from("memberships")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("profile_id", auth.user.id)
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

    // RLS remains authoritative for content visibility. The extra scope filter below
    // only prevents a member's Home from mixing in public posts from other Expressions.
    const client = auth?.client ?? publicClient();
    const degraded: string[] = [];
    const recentEventCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [streamsResult, reelsResult, videosResult, sermonsResult, eventsResult, postsResult] = await Promise.all([
      client
        .from("live_streams")
        .select("id,organization_id,branch_id,title,description,status,visibility,scheduled_start,started_at,ended_at,recording_url,thumbnail_url,viewer_count,playback_url,playback_token_required,created_at")
        .eq("organization_id", organizationId)
        .in("status", ["scheduled", "live", "ended"])
        .order("scheduled_start", { ascending: false, nullsFirst: false })
        .limit(30),
      client
        .from("reels")
        .select("id,organization_id,media_asset_id,caption,audio_title,audio_artist,views_count,likes_count,comments_count,shares_count,created_at,content_items!inner(id,organization_id,expression_id,visibility,status,published_at),media_assets(id,media_type,processing_state,duration_seconds,aspect_ratio,media_renditions(id,rendition_kind,container,codec,width,height,storage_path,provider_playback_id),media_thumbnails(storage_path,is_primary))")
        .eq("organization_id", organizationId)
        .eq("content_items.status", "published")
        .order("created_at", { ascending: false })
        .limit(40),
      client
        .from("videos")
        .select("id,organization_id,media_asset_id,series_id,title,slug,description,category,chapters,transcript,views_count,likes_count,comments_count,shares_count,created_at,content_items!inner(id,organization_id,expression_id,visibility,status,published_at),media_assets(id,media_type,processing_state,duration_seconds,aspect_ratio,media_renditions(id,rendition_kind,container,codec,width,height,storage_path,provider_playback_id),media_thumbnails(storage_path,is_primary))")
        .eq("organization_id", organizationId)
        .eq("content_items.status", "published")
        .order("created_at", { ascending: false })
        .limit(40),
      client
        .from("sermons")
        .select("id,organization_id,expression_id,series_id,title,slug,preacher,sermon_date,scripture_references,topics,description,transcript,audio_url,video_url,thumbnail_url,audio_asset_id,video_asset_id,chapters,duration_seconds,status,visibility,is_featured,play_count,published_at,created_at")
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
      client
        .from("social_posts")
        .select("id,organization_id,author_membership_id,branch_id,group_id,visibility,status,body,media,published_at,edited_at,created_at,social_reactions(reaction)")
        .eq("organization_id", organizationId)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(60),
    ]);

    const streams = resultData<any[]>(streamsResult as any, "live", degraded)
      .filter((row) => inSelectedExperience(row, selectedExpressionId, "branch_id"))
      .map((stream) => ({
        ...stream,
        playback_url: stream.playback_token_required ? null : stream.playback_url,
        recording_url: stream.playback_token_required ? null : stream.recording_url,
      }));
    const reels = resultData<any[]>(reelsResult as any, "reels", degraded)
      .filter((row) => inSelectedExperience(row, selectedExpressionId, "content_items"));
    const videos = resultData<any[]>(videosResult as any, "videos", degraded)
      .filter((row) => inSelectedExperience(row, selectedExpressionId, "content_items"));
    const sermons = resultData<any[]>(sermonsResult as any, "sermons", degraded)
      .filter((row) => inSelectedExperience(row, selectedExpressionId, "expression_id"));
    const events = resultData<any[]>(eventsResult as any, "events", degraded)
      .filter((row) => inSelectedExperience(row, selectedExpressionId, "branch_id"));
    const rawPosts = resultData<any[]>(postsResult as any, "community", degraded)
      .filter((row) => inSelectedExperience(row, selectedExpressionId, "branch_id"));
    const posts = await enrichSocialPosts(rawPosts);

    if (degraded.length === 6) {
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
        posts,
        degradedSections: degraded,
      },
    };
  },
));
