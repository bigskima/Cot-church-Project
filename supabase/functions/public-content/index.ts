import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient, publicClient } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const url = new URL(request.url);
    const orgParam = url.searchParams.get("organizationId");
    const organizationId = orgParam ? uuid(orgParam, "organizationId", true) : null;
    const expressionParam = url.searchParams.get("expressionId");
    const expressionId = expressionParam ? uuid(expressionParam, "expressionId", true) : null;
    const type = url.searchParams.get("type") ?? "feed";
    const client = publicClient();

    if (type === "reels") {
      let query = client
        .from("reels")
        .select(`
          id, organization_id, media_asset_id, caption, audio_title, audio_artist,
          views_count, likes_count, comments_count, shares_count, created_at,
          content_items!inner(id, organization_id, expression_id, visibility, status, published_at),
          media_assets(id, media_type, duration_seconds, aspect_ratio,
            media_renditions(id, rendition_kind, container, codec, width, height, storage_path, provider_playback_id),
            media_thumbnails(storage_path, is_primary))
        `)
        .eq("content_items.visibility", "public")
        .eq("content_items.status", "published")
        .order("created_at", { ascending: false })
        .limit(30);
      if (organizationId) query = query.eq("organization_id", organizationId);
      if (expressionId) query = query.eq("content_items.expression_id", expressionId);
      const { data, error } = await query;
      if (error) throw new ApiError("PUBLIC_REELS_FAILED", "Unable to retrieve public reels", 500, undefined, false);
      return { data: data ?? [] };
    }

    if (type === "videos") {
      let query = client
        .from("videos")
        .select(`
          id, organization_id, media_asset_id, series_id, title, slug, description, category,
          chapters, transcript, views_count, likes_count, comments_count, shares_count, created_at,
          content_items!inner(id, organization_id, expression_id, visibility, status, published_at),
          media_assets(id, media_type, duration_seconds, aspect_ratio,
            media_renditions(id, rendition_kind, container, codec, width, height, storage_path, provider_playback_id),
            media_thumbnails(storage_path, is_primary))
        `)
        .eq("content_items.visibility", "public")
        .eq("content_items.status", "published")
        .order("created_at", { ascending: false })
        .limit(30);
      if (organizationId) query = query.eq("organization_id", organizationId);
      if (expressionId) query = query.eq("content_items.expression_id", expressionId);
      const { data, error } = await query;
      if (error) throw new ApiError("PUBLIC_VIDEOS_FAILED", "Unable to retrieve public videos", 500, undefined, false);
      return { data: data ?? [] };
    }

    if (type === "sermons") {
      let query = client
        .from("sermons")
        .select("id,organization_id,expression_id,series_id,title,slug,preacher,sermon_date,scripture_references,topics,description,transcript,audio_url,video_url,thumbnail_url,audio_asset_id,video_asset_id,chapters,duration_seconds,status,visibility,is_featured,play_count,published_at")
        .eq("visibility", "public")
        .eq("status", "published")
        .order("sermon_date", { ascending: false })
        .limit(50);
      if (organizationId) query = query.eq("organization_id", organizationId);
      if (expressionId) query = query.eq("expression_id", expressionId);
      const { data, error } = await query;
      if (error) throw new ApiError("PUBLIC_SERMONS_FAILED", "Unable to retrieve public sermons", 500, undefined, false);
      return { data: data ?? [] };
    }

    if (type === "series") {
      let query = client
        .from("sermon_series")
        .select("id,organization_id,expression_id,title,slug,description,artwork_url,starts_at,ends_at,is_featured,created_at,updated_at")
        .order("is_featured", { ascending: false })
        .order("starts_at", { ascending: false, nullsFirst: false })
        .limit(50);
      if (organizationId) query = query.eq("organization_id", organizationId);
      if (expressionId) query = query.eq("expression_id", expressionId);
      const { data, error } = await query;
      if (error) throw new ApiError("PUBLIC_SERIES_FAILED", "Unable to retrieve public sermon series", 500, undefined, false);
      return { data: data ?? [] };
    }

    if (type === "leaders") {
      // General Community leadership is curated centrally. Expression leadership is
      // a separate, membership-scoped experience and is never leaked through this endpoint.
      let query = client
        .from("leadership_profiles")
        .select("id,organization_id,profile_id,display_name,portrait_url,role_title,short_bio,full_bio,ministry,display_order,tenure_start,tenure_end,is_founder,is_featured_public,social_links")
        .is("expression_id", null)
        .eq("is_active", true)
        .eq("is_featured_public", true)
        .order("display_order", { ascending: true })
        .limit(100);
      if (organizationId) query = query.eq("organization_id", organizationId);
      const { data, error } = await query;
      if (error) throw new ApiError("PUBLIC_LEADERS_FAILED", "Unable to retrieve public church leadership", 500, undefined, false);
      return {
        data: (data ?? []).map((leader) => ({
          id: leader.id,
          organization_id: leader.organization_id,
          expression_id: null,
          profile_id: leader.profile_id,
          name: leader.display_name,
          role_title: leader.role_title,
          biography: leader.full_bio || leader.short_bio || "",
          short_bio: leader.short_bio,
          avatar_url: leader.portrait_url,
          ministry: leader.ministry,
          is_founder: leader.is_founder,
          display_order: leader.display_order,
          social_links: leader.social_links,
        })),
      };
    }

    if (type === "search") {
      const q = url.searchParams.get("q")?.trim() ?? "";
      if (!q) return { data: { sermons: [], videos: [], reels: [], expressions: [], leaders: [] } };

      let sermonsQuery = client
        .from("sermons")
        .select("id,organization_id,title,preacher,sermon_date,thumbnail_url,duration_seconds")
        .eq("visibility", "public")
        .eq("status", "published")
        .ilike("title", `%${q}%`)
        .limit(10);
      let videosQuery = client
        .from("videos")
        .select("id,organization_id,title,slug,category,views_count,created_at,content_items!inner(visibility,status)")
        .eq("content_items.visibility", "public")
        .eq("content_items.status", "published")
        .ilike("title", `%${q}%`)
        .limit(10);
      let reelsQuery = client
        .from("reels")
        .select("id,organization_id,caption,audio_title,views_count,created_at,content_items!inner(visibility,status)")
        .eq("content_items.visibility", "public")
        .eq("content_items.status", "published")
        .ilike("caption", `%${q}%`)
        .limit(10);
      let expressionsQuery = client
        .from("branches")
        .select("id,organization_id,name,city,state,country,is_primary")
        .eq("is_active", true)
        .ilike("name", `%${q}%`)
        .limit(10);
      let leadersQuery = client
        .from("leadership_profiles")
        .select("id,organization_id,display_name,role_title,portrait_url,is_founder")
        .is("expression_id", null)
        .eq("is_active", true)
        .eq("is_featured_public", true)
        .ilike("display_name", `%${q}%`)
        .limit(10);
      if (organizationId) {
        sermonsQuery = sermonsQuery.eq("organization_id", organizationId);
        videosQuery = videosQuery.eq("organization_id", organizationId);
        reelsQuery = reelsQuery.eq("organization_id", organizationId);
        expressionsQuery = expressionsQuery.eq("organization_id", organizationId);
        leadersQuery = leadersQuery.eq("organization_id", organizationId);
      }
      const [sermonsRes, videosRes, reelsRes, expressionsRes, leadersRes] = await Promise.all([
        sermonsQuery, videosQuery, reelsQuery, expressionsQuery, leadersQuery,
      ]);
      return {
        data: {
          sermons: sermonsRes.data ?? [],
          videos: videosRes.data ?? [],
          reels: reelsRes.data ?? [],
          expressions: expressionsRes.data ?? [],
          leaders: (leadersRes.data ?? []).map((leader) => ({
            id: leader.id,
            organization_id: leader.organization_id,
            name: leader.display_name,
            role_title: leader.role_title,
            avatar_url: leader.portrait_url,
            is_founder: leader.is_founder,
          })),
        },
      };
    }

    if (type === "streams") {
      let query = client
        .from("live_streams")
        .select("id,organization_id,branch_id,title,description,status,playback_url,playback_token_required,scheduled_start,started_at,ended_at,recording_url,thumbnail_url")
        .eq("visibility", "public")
        .in("status", ["scheduled", "live", "ended"])
        .order("scheduled_start", { ascending: false })
        .limit(50);
      if (organizationId) query = query.eq("organization_id", organizationId);
      const { data, error } = await query;
      if (error) throw new ApiError("PUBLIC_STREAMS_FAILED", "Unable to retrieve public streams", 500, undefined, false);

      const streams = data ?? [];
      const activeViewerCounts = new Map<string, number>();
      let viewerCountsAvailable = true;
      if (streams.some((stream) => stream.status === "live")) {
        const liveIds = streams.filter((stream) => stream.status === "live").map((stream) => stream.id);
        const heartbeatCutoff = new Date(Date.now() - 90_000).toISOString();
        const { data: viewers, error: viewerError } = await adminClient()
          .from("stream_viewer_sessions")
          .select("stream_id")
          .in("stream_id", liveIds)
          .is("left_at", null)
          .gte("last_heartbeat_at", heartbeatCutoff);
        if (viewerError) {
          viewerCountsAvailable = false;
        } else {
          for (const viewer of viewers ?? []) {
            activeViewerCounts.set(viewer.stream_id, (activeViewerCounts.get(viewer.stream_id) ?? 0) + 1);
          }
        }
      }

      return {
        data: streams.map((stream) => ({
          ...stream,
          playback_url: stream.playback_token_required ? null : stream.playback_url,
          recording_url: stream.playback_token_required ? null : stream.recording_url,
          ...(stream.status === "live" && viewerCountsAvailable
            ? { viewer_count: activeViewerCounts.get(stream.id) ?? 0 }
            : {}),
        })),
      };
    }

    if (type === "events") {
      let query = client
        .from("events")
        .select("id,organization_id,title,description,starts_at,ends_at,location,capacity,visibility")
        .eq("visibility", "public")
        .order("starts_at", { ascending: true })
        .limit(50);
      if (organizationId) query = query.eq("organization_id", organizationId);
      const { data, error } = await query;
      if (error) throw new ApiError("PUBLIC_EVENTS_FAILED", "Unable to retrieve public events", 500, undefined, false);
      return { data: data ?? [] };
    }

    if (type === "giving") {
      // Legacy compatibility only. The canonical giving endpoint is public-giving.
      // General Community giving must never mix Expression destinations into this response.
      let campaignQuery = client
        .from("giving_campaigns")
        .select("id,organization_id,branch_id,name,description,currency,goal_amount_minor,status,starts_at,ends_at")
        .is("branch_id", null)
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (organizationId) campaignQuery = campaignQuery.eq("organization_id", organizationId);

      let bankQuery = client
        .from("organization_bank_accounts")
        .select("id,organization_id,branch_id,bank_name,account_name,account_number,routing_number,currency,transfer_instructions,reference_prefix")
        .is("branch_id", null)
        .eq("is_public", true)
        .limit(50);
      if (organizationId) bankQuery = bankQuery.eq("organization_id", organizationId);

      const [campaignsRes, bankRes] = await Promise.all([campaignQuery, bankQuery]);
      if (campaignsRes.error || bankRes.error) throw new ApiError("PUBLIC_GIVING_FAILED", "Unable to retrieve giving information", 500, undefined, false);
      return {
        data: {
          campaigns: campaignsRes.data ?? [],
          bankAccounts: bankRes.data ?? [],
          supportedMethods: ["manual_bank_transfer"],
        },
      };
    }

    if (type === "churches") {
      const { data, error } = await client
        .from("organizations")
        .select("id,name,slug,timezone,created_at")
        .eq("status", "active")
        .order("name", { ascending: true })
        .limit(50);
      if (error) throw new ApiError("PUBLIC_CHURCHES_FAILED", "Unable to retrieve churches", 500, undefined, false);
      return { data: data ?? [] };
    }

    let feedQuery = client
      .from("social_posts")
      .select("id,organization_id,body,media,published_at,visibility")
      .eq("visibility", "public")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);
    if (organizationId) feedQuery = feedQuery.eq("organization_id", organizationId);
    const { data, error } = await feedQuery;
    if (error) throw new ApiError("PUBLIC_FEED_FAILED", "Unable to retrieve public feed", 500, undefined, false);
    return { data: data ?? [] };
  },
));
