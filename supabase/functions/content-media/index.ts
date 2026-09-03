import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient, publicClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const BUCKET = "content-media";
const MAX_BYTES = 200 * 1024 * 1024;
const MEDIA_TYPES = new Set(["video", "audio", "image"]);
const MIME_TYPES: Record<string, { mediaType: "video" | "audio" | "image"; ext: string; rendition: "video_stream" | "audio_stream" | null }> = {
  "video/mp4": { mediaType: "video", ext: "mp4", rendition: "video_stream" },
  "video/webm": { mediaType: "video", ext: "webm", rendition: "video_stream" },
  "video/quicktime": { mediaType: "video", ext: "mov", rendition: "video_stream" },
  "audio/mpeg": { mediaType: "audio", ext: "mp3", rendition: "audio_stream" },
  "audio/mp4": { mediaType: "audio", ext: "m4a", rendition: "audio_stream" },
  "audio/aac": { mediaType: "audio", ext: "aac", rendition: "audio_stream" },
  "audio/ogg": { mediaType: "audio", ext: "ogg", rendition: "audio_stream" },
  "audio/wav": { mediaType: "audio", ext: "wav", rendition: "audio_stream" },
  "image/jpeg": { mediaType: "image", ext: "jpg", rendition: null },
  "image/png": { mediaType: "image", ext: "png", rendition: null },
  "image/webp": { mediaType: "image", ext: "webp", rendition: null },
};

function fileSize(value: unknown) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0 || result > MAX_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "Content media must be 200 MB or smaller", 413);
  }
  return result;
}

function fileName(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, 255);
}

Deno.serve(createHandler(
  { methods: ["GET", "POST", "DELETE"], authentication: "optional", organization: "optional" },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const admin = adminClient();

    if (request.method === "GET" && url.searchParams.get("action") === "playback") {
      const contentId = uuid(url.searchParams.get("contentId"), "contentId");
      if (!contentId) throw new ApiError("VALIDATION_FAILED", "contentId is required", 400);

      const visibilityClient = auth?.client ?? publicClient();
      const { data, error } = await visibilityClient.rpc("get_media_playback_info", { p_content_id: contentId });
      if (error) {
        if (error.code === "403") throw new ApiError("FORBIDDEN", "Media playback restricted", 403);
        if (error.code === "404") throw new ApiError("NOT_FOUND", "Content not found", 404);
        throw new ApiError("PLAYBACK_INFO_FAILED", "Unable to resolve media playback", 500, undefined, false);
      }
      if (!data?.available) return { data };

      const renditions = await Promise.all((data.renditions ?? []).map(async (rendition: Record<string, unknown>) => {
        const storagePath = typeof rendition.storagePath === "string" ? rendition.storagePath : null;
        if (!storagePath) return rendition;
        const { data: signed, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
        if (signedError || !signed?.signedUrl) throw new ApiError("PLAYBACK_SIGNING_FAILED", "Unable to authorize media playback", 500, undefined, false);
        return { ...rendition, playbackUrl: signed.signedUrl };
      }));
      return { data: { ...data, renditions } };
    }

    if (!auth?.user || !auth.organizationId) {
      throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication and church context required", 401);
    }

    if (request.method === "DELETE") {
      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["assetId"]);
      const assetId = uuid(requiredString(body.assetId, "assetId", 36), "assetId", true)!;
      const { data: asset, error } = await admin
        .from("media_assets")
        .select("id,source_storage_path,processing_state")
        .eq("id", assetId)
        .eq("organization_id", auth.organizationId)
        .eq("created_by", auth.user.id)
        .maybeSingle();
      if (error || !asset) throw new ApiError("ASSET_NOT_FOUND", "Media asset not found", 404);
      const { count } = await admin.from("content_items").select("id", { count: "exact", head: true }).or(`id.in.(select id from reels where media_asset_id='${assetId}'),id.in.(select id from videos where media_asset_id='${assetId}')`);
      if ((count ?? 0) > 0) throw new ApiError("ASSET_IN_USE", "Published media cannot be deleted from the upload session", 409);
      if (asset.source_storage_path) await admin.storage.from(BUCKET).remove([asset.source_storage_path]);
      await admin.from("media_assets").delete().eq("id", assetId).eq("organization_id", auth.organizationId).eq("created_by", auth.user.id);
      return { data: { assetId, deleted: true } };
    }

    const body = assertObject(await jsonBody(request));

    if (body.action === "create_upload_intent") {
      assertNoUnknownFields(body, ["action", "mediaType", "mimeType", "expressionId", "durationSeconds", "aspectRatio", "fileSizeBytes", "fileName"]);
      await authorize(auth, "media.upload");

      const mediaType = requiredString(body.mediaType, "mediaType", 20);
      const mimeType = requiredString(body.mimeType, "mimeType", 120).toLowerCase();
      const mime = MIME_TYPES[mimeType];
      if (!MEDIA_TYPES.has(mediaType) || !mime || mime.mediaType !== mediaType) {
        throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "This media format is not supported for the selected content type", 415);
      }
      const sizeBytes = fileSize(body.fileSizeBytes);
      const expressionId = body.expressionId ? uuid(String(body.expressionId), "expressionId", true) : null;
      if (expressionId && expressionId !== auth.branchId) {
        throw new ApiError("EXPRESSION_SCOPE_DENIED", "Media can only be uploaded for your selected Expression", 403);
      }
      const durationSeconds = typeof body.durationSeconds === "number" && Number.isFinite(body.durationSeconds) && body.durationSeconds >= 0
        ? Math.round(body.durationSeconds)
        : null;
      const aspectRatio = optionalString(body.aspectRatio, "aspectRatio", 20) ?? (mediaType === "video" ? "9:16" : null);

      const assetId = crypto.randomUUID();
      const storagePath = `orgs/${auth.organizationId}/content/${auth.user.id}/${assetId}.${mime.ext}`;
      const { data: asset, error: assetError } = await admin
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
          file_size_bytes: sizeBytes,
          created_by: auth.user.id,
          metadata: { originalFileName: fileName(body.fileName) },
        })
        .select("id,organization_id,expression_id,media_type,processing_state,source_storage_path,mime_type,file_size_bytes,duration_seconds,aspect_ratio")
        .single();
      if (assetError || !asset) throw new ApiError("ASSET_CREATE_FAILED", "Unable to initialize media upload", 500, undefined, false);

      const { data: signed, error: signedError } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
      if (signedError || !signed?.signedUrl) {
        await admin.from("media_assets").delete().eq("id", assetId);
        throw new ApiError("UPLOAD_SESSION_FAILED", "Unable to create secure media upload session", 500, undefined, false);
      }

      return {
        data: {
          asset,
          uploadSession: {
            assetId,
            storagePath,
            signedUploadUrl: signed.signedUrl,
            uploadToken: signed.token,
          },
        },
        status: 201,
      };
    }

    if (body.action === "complete_upload") {
      assertNoUnknownFields(body, ["action", "assetId"]);
      const assetId = uuid(requiredString(body.assetId, "assetId", 36), "assetId", true)!;
      const { data: asset, error: assetError } = await admin
        .from("media_assets")
        .select("id,organization_id,expression_id,media_type,processing_state,source_storage_path,mime_type,file_size_bytes,created_by")
        .eq("id", assetId)
        .eq("organization_id", auth.organizationId)
        .eq("created_by", auth.user.id)
        .maybeSingle();
      if (assetError || !asset) throw new ApiError("ASSET_NOT_FOUND", "Media asset not found", 404);
      if (asset.processing_state === "ready") return { data: asset };
      if (asset.processing_state !== "uploading" && asset.processing_state !== "uploaded") {
        throw new ApiError("ASSET_STATE_INVALID", "This media upload cannot be completed", 409);
      }
      if (!asset.source_storage_path) throw new ApiError("ASSET_STATE_INVALID", "Media asset has no source path", 409);

      const segments = asset.source_storage_path.split("/");
      const objectName = segments.pop()!;
      const directory = segments.join("/");
      const { data: objects, error: objectError } = await admin.storage.from(BUCKET).list(directory, { limit: 20, search: objectName });
      if (objectError) throw new ApiError("MEDIA_VERIFY_FAILED", "Unable to verify uploaded media", 500, undefined, false);
      const object = (objects ?? []).find((item) => item.name === objectName);
      if (!object) throw new ApiError("MEDIA_UPLOAD_INCOMPLETE", "The media file has not finished uploading", 409);
      const actualSize = Number((object as any).metadata?.size ?? asset.file_size_bytes ?? 0);
      if (!Number.isFinite(actualSize) || actualSize <= 0 || actualSize > MAX_BYTES) {
        await admin.storage.from(BUCKET).remove([asset.source_storage_path]);
        await admin.from("media_assets").update({ processing_state: "failed", processing_error: "Invalid uploaded file size" }).eq("id", assetId);
        throw new ApiError("PAYLOAD_TOO_LARGE", "Uploaded media exceeds the 200 MB limit", 413);
      }

      const mime = MIME_TYPES[asset.mime_type];
      if (!mime || mime.mediaType !== asset.media_type) {
        throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "Stored media metadata is invalid", 415);
      }

      if (mime.rendition) {
        const { data: existing } = await admin.from("media_renditions")
          .select("id")
          .eq("media_asset_id", assetId)
          .eq("rendition_kind", mime.rendition)
          .eq("storage_path", asset.source_storage_path)
          .limit(1);
        if (!(existing ?? []).length) {
          const { error: renditionError } = await admin.from("media_renditions").insert({
            organization_id: auth.organizationId,
            media_asset_id: assetId,
            rendition_kind: mime.rendition,
            container: mime.ext,
            codec: "source",
            file_size_bytes: Math.round(actualSize),
            storage_path: asset.source_storage_path,
            is_master: true,
          });
          if (renditionError) throw new ApiError("RENDITION_CREATE_FAILED", "Unable to register uploaded media", 500, undefined, false);
        }
      }

      const { data: completed, error: completeError } = await admin.from("media_assets")
        .update({
          processing_state: "ready",
          file_size_bytes: Math.round(actualSize),
          processing_error: null,
        })
        .eq("id", assetId)
        .eq("organization_id", auth.organizationId)
        .eq("created_by", auth.user.id)
        .select("id,organization_id,expression_id,media_type,processing_state,source_storage_path,mime_type,file_size_bytes,duration_seconds,aspect_ratio")
        .single();
      if (completeError || !completed) throw new ApiError("ASSET_UPDATE_FAILED", "Unable to finalize media upload", 500, undefined, false);
      return { data: completed };
    }

    throw new ApiError("NOT_FOUND", "Endpoint action not recognized", 404);
  },
));