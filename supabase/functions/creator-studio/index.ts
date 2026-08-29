import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const visibilities = new Set(["public", "organization", "branch", "group", "private"]);
const videoCategories = new Set(["documentary", "conference", "worship", "interview", "testimony", "teaching", "programme", "highlights", "podcast", "general"]);

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.user || !auth?.organizationId) {
      throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication and organization context required", 401);
    }

    const url = new URL(request.url);
    const expParam = url.searchParams.get("expressionId");
    const expressionId = expParam ? uuid(expParam, "expressionId", true) : null;

    if (request.method === "GET") {
      // Return scoped creator dashboard overview (Drafts, Processing Media, Published content counts)
      const [draftsRes, mediaQueueRes, publishedCountRes] = await Promise.all([
        auth.client
          .from("content_items")
          .select("id, content_type, status, visibility, created_at, expression_id")
          .eq("organization_id", auth.organizationId)
          .in("status", ["draft", "review", "scheduled"])
          .order("created_at", { ascending: false })
          .limit(20),
        auth.client
          .from("media_assets")
          .select("id, media_type, processing_state, duration_seconds, created_at")
          .eq("organization_id", auth.organizationId)
          .in("processing_state", ["uploading", "processing"])
          .order("created_at", { ascending: false })
          .limit(20),
        auth.client
          .from("content_items")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", auth.organizationId)
          .eq("status", "published"),
      ]);

      return {
        data: {
          drafts: draftsRes.data ?? [],
          mediaQueue: mediaQueueRes.data ?? [],
          totalPublished: publishedCountRes.count ?? 0,
        },
      };
    }

    if (request.method === "POST") {
      const body = assertObject(await jsonBody(request));

      // 1. Publish Social Post
      if (body.action === "publish_post") {
        assertNoUnknownFields(body, ["action", "expressionId", "groupId", "visibility", "body", "media"]);
        const targetExp = body.expressionId ? uuid(String(body.expressionId), "expressionId", true) : null;
        const targetGroup = body.groupId ? uuid(String(body.groupId), "groupId", true) : null;
        const visibility = requiredString(body.visibility, "visibility", 20);
        const postBody = requiredString(body.body, "body", 10000);

        if (!visibilities.has(visibility)) throw new ApiError("VALIDATION_FAILED", "Invalid visibility", 422);

        const { data, error } = await auth.client.rpc("publish_typed_post", {
          p_org_id: auth.organizationId,
          p_expression_id: targetExp,
          p_group_id: targetGroup,
          p_visibility: visibility,
          p_body: postBody,
          p_media_json: body.media ?? [],
        });

        if (error) {
          if (error.code === "42501") throw new ApiError("FORBIDDEN", error.message, 403);
          throw new ApiError("POST_PUBLISH_FAILED", error.message, 500, undefined, false);
        }
        return { data, status: 201 };
      }

      // 2. Publish Short Reel
      if (body.action === "publish_reel") {
        assertNoUnknownFields(body, ["action", "expressionId", "visibility", "mediaAssetId", "caption", "audioTitle", "audioArtist"]);
        const targetExp = body.expressionId ? uuid(String(body.expressionId), "expressionId", true) : null;
        const visibility = requiredString(body.visibility, "visibility", 20);
        const assetId = uuid(requiredString(body.mediaAssetId, "mediaAssetId", 36), "mediaAssetId", true)!;
        const caption = requiredString(body.caption, "caption", 2200);
        const audioTitle = optionalString(body.audioTitle, "audioTitle", 100);
        const audioArtist = optionalString(body.audioArtist, "audioArtist", 100);

        if (!visibilities.has(visibility)) throw new ApiError("VALIDATION_FAILED", "Invalid visibility", 422);

        const { data, error } = await auth.client.rpc("publish_typed_reel", {
          p_org_id: auth.organizationId,
          p_expression_id: targetExp,
          p_visibility: visibility,
          p_media_asset_id: assetId,
          p_caption: caption,
          p_audio_title: audioTitle,
          p_audio_artist: audioArtist,
        });

        if (error) {
          if (error.code === "42501") throw new ApiError("FORBIDDEN", error.message, 403);
          throw new ApiError("REEL_PUBLISH_FAILED", error.message, 500, undefined, false);
        }
        return { data, status: 201 };
      }

      // 3. Publish Long Watch Video
      if (body.action === "publish_video") {
        assertNoUnknownFields(body, ["action", "expressionId", "visibility", "mediaAssetId", "title", "description", "category", "seriesId", "chapters"]);
        const targetExp = body.expressionId ? uuid(String(body.expressionId), "expressionId", true) : null;
        const visibility = requiredString(body.visibility, "visibility", 20);
        const assetId = uuid(requiredString(body.mediaAssetId, "mediaAssetId", 36), "mediaAssetId", true)!;
        const title = requiredString(body.title, "title", 200);
        const description = optionalString(body.description, "description", 5000) ?? "";
        const category = optionalString(body.category, "category", 30) ?? "general";
        const seriesId = body.seriesId ? uuid(String(body.seriesId), "seriesId", true) : null;

        if (!visibilities.has(visibility)) throw new ApiError("VALIDATION_FAILED", "Invalid visibility", 422);
        if (!videoCategories.has(category)) throw new ApiError("VALIDATION_FAILED", "Invalid category", 422);

        const { data, error } = await auth.client.rpc("publish_typed_video", {
          p_org_id: auth.organizationId,
          p_expression_id: targetExp,
          p_visibility: visibility,
          p_media_asset_id: assetId,
          p_title: title,
          p_description: description,
          p_category: category,
          p_series_id: seriesId,
          p_chapters: body.chapters ?? [],
        });

        if (error) {
          if (error.code === "42501") throw new ApiError("FORBIDDEN", error.message, 403);
          throw new ApiError("VIDEO_PUBLISH_FAILED", error.message, 500, undefined, false);
        }
        return { data, status: 201 };
      }
    }

    throw new ApiError("NOT_FOUND", "Studio action not recognized", 404);
  }
));
