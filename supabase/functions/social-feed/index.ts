import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { enrichContentEngagement, enrichSocialPosts } from "../_shared/public-identity.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const visibilities = new Set(["public", "organization", "branch", "group", "private"]);
const scopes = new Set(["all", "church", "expression"]);

function mediaUploadIds(body: Record<string, unknown>) {
  const source = body.mediaUploadIds ?? body.media ?? [];
  if (!Array.isArray(source)) throw new ApiError("VALIDATION_FAILED", "media must be an array", 422);
  if (source.length > 10) throw new ApiError("VALIDATION_FAILED", "A feed post can contain at most 10 media items", 422);
  return source.map((item, index) => {
    const value = typeof item === "string"
      ? item
      : item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>).uploadId
        : null;
    if (typeof value !== "string") throw new ApiError("VALIDATION_FAILED", `Media item ${index + 1} is missing its upload id`, 422);
    return uuid(value, `mediaUploadIds[${index}]`, true)!;
  });
}

function postBody(value: unknown, hasMedia: boolean) {
  if (value === undefined || value === null) {
    if (hasMedia) return "";
    throw new ApiError("VALIDATION_FAILED", "Write something or attach media before publishing", 422);
  }
  if (typeof value !== "string") throw new ApiError("VALIDATION_FAILED", "Post text must be text", 422);
  const normalized = value.trim();
  if (!normalized && !hasMedia) throw new ApiError("VALIDATION_FAILED", "Write something or attach media before publishing", 422);
  if (normalized.length > 10000) throw new ApiError("VALIDATION_FAILED", "Post text must be 10,000 characters or fewer", 422);
  return normalized;
}

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId) throw new ApiError("ORGANIZATION_REQUIRED", "Organization context is required", 400);

    if (request.method === "GET") {
      const url = new URL(request.url);
      const postId = uuid(url.searchParams.get("postId"), "postId");
      if (postId) {
        const { data, error } = await auth.client
          .from("content_comments")
          .select("id,content_item_id,author_profile_id,parent_comment_id,body,created_at,profiles(id,display_name,avatar_url)")
          .eq("content_item_id", postId)
          .eq("is_hidden", false)
          .order("created_at")
          .limit(200);
        if (error) throw new ApiError("COMMENT_LIST_FAILED", "Unable to retrieve comments", 500, undefined, false);
        return { data: data ?? [] };
      }

      const scope = url.searchParams.get("scope") ?? "all";
      if (!scopes.has(scope)) throw new ApiError("VALIDATION_FAILED", "Invalid community feed scope", 422);
      let query = auth.client.from("social_posts")
        .select("id,organization_id,author_membership_id,branch_id,group_id,visibility,status,body,media,published_at,edited_at,created_at")
        .eq("organization_id", auth.organizationId)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(100);
      if (scope === "church") query = query.is("branch_id", null).eq("visibility", "public");
      if (scope === "expression") {
        if (!auth.branchId) throw new ApiError("EXPRESSION_REQUIRED", "Join or select an Expression to view its feed", 403);
        query = query.eq("branch_id", auth.branchId);
      }
      const { data, error } = await query;
      if (error) throw new ApiError("FEED_READ_FAILED", "Unable to retrieve community feed", 500, undefined, false);
      const identified = await enrichSocialPosts(data ?? []);
      return {
        data: await enrichContentEngagement(identified, auth.client, auth.user.id),
      };
    }

    const body = assertObject(await jsonBody(request));
    if (body.action === "comment") {
      assertNoUnknownFields(body, ["action", "postId", "body", "parentCommentId"]);
      const contentId = uuid(requiredString(body.postId, "postId", 36), "postId", true)!;
      const parentCommentId = body.parentCommentId
        ? uuid(String(body.parentCommentId), "parentCommentId", true)
        : null;
      const { data, error } = await auth.client
        .from("content_comments")
        .insert({
          content_item_id: contentId,
          author_profile_id: auth.user.id,
          parent_comment_id: parentCommentId,
          body: requiredString(body.body, "body", 3000).trim(),
        })
        .select("id,content_item_id,author_profile_id,parent_comment_id,body,created_at,profiles(id,display_name,avatar_url)")
        .single();
      if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "You do not have access to comment on this post", 403);
      if (error) throw new ApiError("COMMENT_CREATE_FAILED", "Unable to comment", 500, undefined, false);
      return { data, status: 201 };
    }
    if (body.action === "react") {
      assertNoUnknownFields(body, ["action", "postId", "reaction"]);
      const contentId = uuid(requiredString(body.postId, "postId", 36), "postId", true)!;
      const reaction = requiredString(body.reaction, "reaction", 20);
      if (!new Set(["like", "love", "pray", "celebrate", "amen", "support"]).has(reaction)) {
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
      if (error?.code === "42501") throw new ApiError("PERMISSION_DENIED", "You do not have access to react to this post", 403);
      if (error) throw new ApiError("REACTION_FAILED", "Unable to react", 500, undefined, false);
      return { data };
    }

    assertNoUnknownFields(body, ["body", "visibility", "branchId", "groupId", "media", "mediaUploadIds"]);
    const visibility = requiredString(body.visibility, "visibility", 20);
    if (!visibilities.has(visibility)) throw new ApiError("VALIDATION_FAILED", "Invalid visibility", 422);
    const uploadIds = mediaUploadIds(body);
    const normalizedBody = postBody(body.body, uploadIds.length > 0);
    const targetBranchId = body.branchId ? uuid(String(body.branchId), "branchId", true) : null;
    const targetGroupId = body.groupId ? uuid(String(body.groupId), "groupId", true) : null;

    const { data, error } = await auth.client.rpc("publish_social_post_with_uploads", {
      target_organization_id: auth.organizationId,
      target_visibility: visibility,
      post_body: normalizedBody,
      target_branch_id: targetBranchId,
      target_group_id: targetGroupId,
      target_upload_ids: uploadIds,
    }).single();

    if (error?.code === "42501") {
      const message = String(error.message ?? "");
      if (message.includes("Posting is restricted")) throw new ApiError("POSTING_RESTRICTED", "Your posting access is currently restricted", 403);
      if (message.includes("Expression membership required")) throw new ApiError("EXPRESSION_MEMBERSHIP_REQUIRED", "Join an Expression before publishing", 403);
      if (message.includes("your own Expression")) throw new ApiError("EXPRESSION_SCOPE_DENIED", "You may publish only to your own Expression", 403);
      if (message.includes("media uploads")) throw new ApiError("MEDIA_SCOPE_DENIED", "One or more media uploads cannot be used in this feed", 403);
      throw new ApiError("PERMISSION_DENIED", "You do not have permission to publish this post", 403);
    }
    if (error?.code === "22023" || error?.code === "23514") {
      throw new ApiError("VALIDATION_FAILED", error.message, 422);
    }
    if (error) throw new ApiError("POST_CREATE_FAILED", "Unable to publish post", 500, undefined, false);
    return { data, status: 201 };
  },
));
