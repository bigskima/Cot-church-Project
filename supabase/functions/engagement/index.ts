import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const allowedReactions = new Set(["like", "love", "pray", "celebrate", "amen", "support"]);

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "optional", organization: "optional" },
  async ({ request, auth }) => {
    const url = new URL(request.url);

    // GET Comments on Content Item (publicly readable if content item is public)
    if (request.method === "GET") {
      const contentId = uuid(url.searchParams.get("contentId"), "contentId");
      if (!contentId) throw new ApiError("VALIDATION_FAILED", "contentId is required", 400);

      const client = auth?.client ?? (await import("../_shared/supabase.ts")).publicClient();
      if (url.searchParams.get("view") === "state") {
        if (!auth?.user) return { data: { reaction: null, bookmarked: false, progress: null } };
        const [reaction, bookmark, progress] = await Promise.all([
          auth.client.from("content_reactions").select("reaction").eq("content_item_id", contentId).eq("profile_id", auth.user.id).maybeSingle(),
          auth.client.from("content_bookmarks").select("content_item_id").eq("content_item_id", contentId).eq("profile_id", auth.user.id).maybeSingle(),
          auth.client.from("content_playback_progress").select("progress_seconds,duration_seconds,completed,last_played_at").eq("content_item_id", contentId).eq("profile_id", auth.user.id).maybeSingle(),
        ]);
        if (reaction.error || bookmark.error || progress.error) throw new ApiError("ENGAGEMENT_STATE_FAILED", "Unable to retrieve your content activity", 500, undefined, false);
        return { data: { reaction: reaction.data?.reaction ?? null, bookmarked: Boolean(bookmark.data), progress: progress.data ?? null } };
      }
      const { data, error } = await client
        .from("content_comments")
        .select(`
          id,
          content_item_id,
          author_profile_id,
          parent_comment_id,
          body,
          created_at,
          profiles(id, display_name, avatar_url)
        `)
        .eq("content_item_id", contentId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw new ApiError("COMMENTS_FETCH_FAILED", "Unable to retrieve comments", 500, undefined, false);
      return { data: data ?? [] };
    }

    // POST Actions require authentication
    if (!auth?.user) {
      throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required for engagement", 401);
    }

    const body = assertObject(await jsonBody(request));

    // 1. React
    if (body.action === "react") {
      assertNoUnknownFields(body, ["action", "contentId", "reaction"]);
      const contentId = uuid(requiredString(body.contentId, "contentId", 36), "contentId", true)!;
      const reaction = requiredString(body.reaction, "reaction", 20);

      if (!allowedReactions.has(reaction)) {
        throw new ApiError("VALIDATION_FAILED", "Invalid reaction type", 422);
      }

      const { data, error } = await auth.client
        .from("content_reactions")
        .upsert({
          content_item_id: contentId,
          profile_id: auth.user.id,
          reaction,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw new ApiError("REACTION_FAILED", "Unable to record reaction", 500, undefined, false);
      return { data };
    }

    if (body.action === "unreact") {
      assertNoUnknownFields(body, ["action", "contentId"]);
      const contentId = uuid(requiredString(body.contentId, "contentId", 36), "contentId", true)!;
      const { error } = await auth.client.from("content_reactions").delete().eq("content_item_id", contentId).eq("profile_id", auth.user.id);
      if (error) throw new ApiError("REACTION_FAILED", "Unable to remove reaction", 500, undefined, false);
      return { data: { reacted: false } };
    }

    // 2. Comment / Reply
    if (body.action === "comment") {
      assertNoUnknownFields(body, ["action", "contentId", "body", "parentCommentId"]);
      const contentId = uuid(requiredString(body.contentId, "contentId", 36), "contentId", true)!;
      const commentBody = requiredString(body.body, "body", 3000);
      const parentId = body.parentCommentId ? uuid(String(body.parentCommentId), "parentCommentId", true) : null;

      const { data, error } = await auth.client
        .from("content_comments")
        .insert({
          content_item_id: contentId,
          author_profile_id: auth.user.id,
          parent_comment_id: parentId,
          body: commentBody.trim(),
        })
        .select(`
          id,
          content_item_id,
          author_profile_id,
          parent_comment_id,
          body,
          created_at,
          profiles(id, display_name, avatar_url)
        `)
        .single();

      if (error) throw new ApiError("COMMENT_FAILED", "Unable to post comment", 500, undefined, false);
      return { data, status: 201 };
    }

    // 3. Bookmark
    if (body.action === "bookmark") {
      assertNoUnknownFields(body, ["action", "contentId"]);
      const contentId = uuid(requiredString(body.contentId, "contentId", 36), "contentId", true)!;

      const { data: existing } = await auth.client
        .from("content_bookmarks")
        .select("content_item_id")
        .eq("content_item_id", contentId)
        .eq("profile_id", auth.user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await auth.client
          .from("content_bookmarks")
          .delete()
          .eq("content_item_id", contentId)
          .eq("profile_id", auth.user.id);
        if (error) throw new ApiError("BOOKMARK_FAILED", "Unable to remove bookmark", 500, undefined, false);
        return { data: { bookmarked: false } };
      }

      const { error } = await auth.client
        .from("content_bookmarks")
        .insert({ content_item_id: contentId, profile_id: auth.user.id });

      if (error) throw new ApiError("BOOKMARK_FAILED", "Unable to bookmark content", 500, undefined, false);
      return { data: { bookmarked: true }, status: 201 };
    }

    // 4. Playback Progress Sync
    if (body.action === "sync_playback") {
      assertNoUnknownFields(body, ["action", "contentId", "progressSeconds", "durationSeconds"]);
      const contentId = uuid(requiredString(body.contentId, "contentId", 36), "contentId", true)!;
      const progressSeconds = typeof body.progressSeconds === "number" ? Math.max(0, Math.floor(body.progressSeconds)) : 0;
      const durationSeconds = typeof body.durationSeconds === "number" ? Math.max(0, Math.floor(body.durationSeconds)) : 0;

      const { data, error } = await auth.client.rpc("sync_content_playback", {
        p_content_id: contentId,
        p_progress_seconds: progressSeconds,
        p_duration_seconds: durationSeconds,
      });

      if (error) throw new ApiError("PLAYBACK_SYNC_FAILED", "Unable to sync playback", 500, undefined, false);
      return { data };
    }

    // 5. Moderation Report
    if (body.action === "report") {
      assertNoUnknownFields(body, ["action", "contentId", "commentId", "reason", "details", "organizationId", "expressionId"]);
      const contentId = body.contentId ? uuid(String(body.contentId), "contentId", true) : null;
      const commentId = body.commentId ? uuid(String(body.commentId), "commentId", true) : null;
      const reason = requiredString(body.reason, "reason", 200);
      const details = optionalString(body.details, "details", 1000) ?? "";
      const orgId = uuid(requiredString(body.organizationId, "organizationId", 36), "organizationId", true)!;
      const expId = body.expressionId ? uuid(String(body.expressionId), "expressionId", true) : null;

      const { data, error } = await auth.client
        .from("content_moderation_reports")
        .insert({
          organization_id: orgId,
          expression_id: expId,
          content_item_id: contentId,
          comment_id: commentId,
          reporter_profile_id: auth.user.id,
          reason,
          details,
        })
        .select()
        .single();

      if (error) throw new ApiError("REPORT_FAILED", "Unable to submit moderation report", 500, undefined, false);
      return { data, status: 201 };
    }

    throw new ApiError("NOT_FOUND", "Engagement action not recognized", 404);
  }
));
