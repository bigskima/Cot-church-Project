import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST", "PATCH"], authentication: "optional", organization: "optional" },
  async ({ request, auth }) => {
    const url = new URL(request.url);

    // Dynamic Playback Info (Available to anon for public content, or authenticated)
    if (request.method === "GET" && url.searchParams.get("action") === "playback") {
      const contentId = uuid(url.searchParams.get("contentId"), "contentId");
      if (!contentId) throw new ApiError("VALIDATION_FAILED", "contentId is required", 400);

      const client = auth?.client ?? (await import("../_shared/supabase.ts")).publicClient();
      const { data, error } = await client.rpc("get_media_playback_info", { p_content_id: contentId });

      if (error) {
        if (error.code === "403") throw new ApiError("FORBIDDEN", "Media playback restricted", 403);
        if (error.code === "404") throw new ApiError("NOT_FOUND", "Content not found", 404);
        throw new ApiError("PLAYBACK_INFO_FAILED", error.message, 500, undefined, false);
      }
      return { data };
    }

    // Authenticated Media Management
    if (!auth?.user || !auth?.organizationId) {
      throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication and organization context required", 401);
    }

    if (request.method === "POST") {
      const body = assertObject(await jsonBody(request));

      // 1. Create Upload Intent Session
      if (body.action === "create_upload_intent") {
        assertNoUnknownFields(body, ["action", "mediaType", "mimeType", "expressionId", "durationSeconds", "aspectRatio"]);
        await authorize(auth, "media.upload");

        const mediaType = requiredString(body.mediaType, "mediaType", 20);
        const mimeType = optionalString(body.mimeType, "mimeType", 50) ?? "application/octet-stream";
        const expressionId = body.expressionId ? uuid(String(body.expressionId), "expressionId", true) : null;
        const durationSeconds = typeof body.durationSeconds === "number" ? body.durationSeconds : null;
        const aspectRatio = optionalString(body.aspectRatio, "aspectRatio", 10) ?? (mediaType === "video" ? "9:16" : null);

        const assetId = crypto.randomUUID();
        const storagePath = `orgs/${auth.organizationId}/media/${assetId}/source`;

        const { data, error } = await auth.client
          .from("media_assets")
          .insert({
            id: assetId,
            organization_id: auth.organizationId,
            expression_id: expressionId,
            media_type: mediaType,
            processing_state: "uploading",
            source_storage_path: storagePath,
            duration_seconds: durationSeconds,
            aspect_ratio: aspectRatio,
            mime_type: mimeType,
            created_by: auth.user.id,
          })
          .select()
          .single();

        if (error) throw new ApiError("ASSET_CREATE_FAILED", "Unable to initialize media upload", 500, undefined, false);

        return {
          data: {
            asset: data,
            uploadSession: {
              uploadUrl: `/storage/v1/object/upload/media/${storagePath}`,
              assetId,
              storagePath,
            },
          },
          status: 201,
        };
      }

      // 2. Mark Upload Complete & Start Processing Pipeline
      if (body.action === "complete_upload") {
        assertNoUnknownFields(body, ["action", "assetId"]);
        const assetId = uuid(requiredString(body.assetId, "assetId", 36), "assetId", true)!;

        const { data, error } = await auth.client
          .from("media_assets")
          .update({
            processing_state: "ready", // In local/internal adapter, mark ready immediately or dispatch worker
            updated_at: new Date().toISOString(),
          })
          .eq("id", assetId)
          .eq("organization_id", auth.organizationId)
          .select()
          .single();

        if (error) throw new ApiError("ASSET_UPDATE_FAILED", "Unable to update media processing state", 500, undefined, false);
        return { data };
      }
    }

    throw new ApiError("NOT_FOUND", "Endpoint action not recognized", 404);
  }
));
