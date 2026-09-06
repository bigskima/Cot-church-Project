import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { ApiError } from "../_shared/errors.ts";
import { authorize } from "../_shared/context.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { enrichContentCreators } from "../_shared/public-identity.ts";
import { adminClient, publicClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, optionalString, requiredString, uuid } from "../_shared/validation.ts";

const BUCKET = "content-media";
const MAX_BYTES = 200 * 1024 * 1024;
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

function validateSize(value: unknown) {
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "Content media must be 200 MB or smaller", 413);
  }
  return size;
}

function safeFileName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 255) : null;
}

async function findOwnedAsset(organizationId: string, profileId: string, assetId: string) {
  const { data, error } = await adminClient()
    .from("media_assets")
    .select("id,organization_id,expression_id,media_type,processing_state,source_storage_path,mime_type,file_size_bytes,duration_seconds,aspect_ratio,created_by")
    .eq("id", assetId)
    .eq("organization_id", organizationId)
    .eq("created_by", profileId)
    .maybeSingle();
  if (error || !data) throw new ApiError("ASSET_NOT_FOUND", "Media asset not found", 404);
  return data;
}

function playbackContentIds(value: string | null) {
  const ids = [...new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean))];
  if (!ids.length) throw new ApiError("VALIDATION_FAILED", "At least one contentId is required", 400);
  if (ids.length > 30) throw new ApiError("VALIDATION_FAILED", "A maximum of 30 media items can be prepared at once", 422);
  return ids.map((id) => uuid(id, "contentId", true)!);
}

async function resolvePlayback(client: SupabaseClient, admin: SupabaseClient, contentId: string) {
  const { data, error } = await client.rpc("get_media_playback_info", { p_content_id: contentId });
  if (error) {
    if (error.code === "403" || error.code === "42501") throw new ApiError("FORBIDDEN", "Media playback restricted", 403);
    if (error.code === "404" || error.code === "P0002") throw new ApiError("NOT_FOUND", "Content not found", 404);
    throw new ApiError("PLAYBACK_INFO_FAILED", "Unable to resolve media playback", 500, undefined, false);
  }
  if (!data?.available) return data;

  const renditions = await Promise.all((data.renditions ?? []).map(async (rendition: Record<string, unknown>) => {
    const storagePath = typeof rendition.storagePath === "string" ? rendition.storagePath : null;
    if (!storagePath) return rendition;
    const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
    if (signError || !signed?.signedUrl) {
      throw new ApiError("PLAYBACK_SIGNING_FAILED", "Unable to authorize media playback", 500, undefined, false);
    }
    return { ...rendition, playbackUrl: signed.signedUrl };
  }));
  return { ...data, renditions };
}

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "optional", organization: "optional" },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const admin = adminClient();

    if (request.method === "GET" && url.searchParams.get("action") === "video_detail") {
      if (!auth?.user || !auth.organizationId || !auth.branchId) {
        throw new ApiError("EXPRESSION_CONTEXT_REQUIRED", "Enter an Expression to view this internal video", 403);
      }
      const videoId = uuid(url.searchParams.get("id"), "id", true)!;
      const { data, error } = await auth.client
        .from("videos")
        .select("id,organization_id,media_asset_id,series_id,title,slug,description,category,chapters,transcript,views_count,likes_count,comments_count,shares_count,created_at,content_items!inner(id,organization_id,expression_id,author_profile_id,visibility,status,published_at),media_assets(id,media_type,processing_state,duration_seconds,aspect_ratio,media_renditions(id,rendition_kind,container,codec,width,height,storage_path,provider_playback_id),media_thumbnails(storage_path,is_primary))")
        .eq("id", videoId)
        .eq("organization_id", auth.organizationId)
        .eq("content_items.expression_id", auth.branchId)
        .eq("content_items.status", "published")
        .maybeSingle();
      if (error) throw new ApiError("VIDEO_DETAIL_FAILED", "Unable to retrieve this Expression video", 500, undefined, false);
      if (!data) throw new ApiError("VIDEO_NOT_FOUND", "This video is not available in the active Expression", 404);
      const [enriched] = await enrichContentCreators([data]);
      return { data: enriched };
    }

    if (request.method === "GET" && url.searchParams.get("action") === "playback_batch") {
      const contentIds = playbackContentIds(url.searchParams.get("contentIds"));
      const client = auth?.client ?? publicClient();
      const items = await Promise.all(contentIds.map(async (contentId) => ({
        contentId,
        ...(await resolvePlayback(client, admin, contentId)),
      })));
      return { data: items };
    }

    if (request.method === "GET" && url.searchParams.get("action") === "playback") {
      const contentId = uuid(url.searchParams.get("contentId"), "contentId");
      if (!contentId) throw new ApiError("VALIDATION_FAILED", "contentId is required", 400);
      const client = auth?.client ?? publicClient();
      return { data: await resolvePlayback(client, admin, contentId) };
    }

    if (!auth?.user || !auth.organizationId) {
      throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication and church context required", 401);
    }

    const body = assertObject(await jsonBody(request));
    const action = requiredString(body.action, "action", 40);

    if (action === "create_upload_intent") {
      assertNoUnknownFields(body, ["action", "mediaType", "mimeType", "expressionId", "durationSeconds", "aspectRatio", "fileSizeBytes", "fileName"]);
      await authorize(auth, "media.upload");

      const mediaType = requiredString(body.mediaType, "mediaType", 20) as "video" | "audio" | "image";
      const mimeType = requiredString(body.mimeType, "mimeType", 120).toLowerCase();
      const mime = MIME_TYPES[mimeType];
      if (!mime || mime.mediaType !== mediaType) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "This media format is not supported", 415);
      const fileSizeBytes = validateSize(body.fileSizeBytes);
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

      const { data: asset, error: createError } = await admin.from("media_assets").insert({
        id: assetId,
        organization_id: auth.organizationId,
        expression_id: expressionId,
        media_type: mediaType,
        processing_state: "uploading",
        source_storage_path: storagePath,
        duration_seconds: durationSeconds,
        aspect_ratio: aspectRatio,
        mime_type: mimeType,
        file_size_bytes: fileSizeBytes,
        created_by: auth.user.id,
        metadata: { originalFileName: safeFileName(body.fileName) },
      }).select("id,organization_id,expression_id,media_type,processing_state,source_storage_path,mime_type,file_size_bytes,duration_seconds,aspect_ratio").single();
      if (createError || !asset) throw new ApiError("ASSET_CREATE_FAILED", "Unable to initialize media upload", 500, undefined, false);

      const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
      if (signError || !signed?.signedUrl) {
        await admin.from("media_assets").delete().eq("id", assetId);
        throw new ApiError("UPLOAD_SESSION_FAILED", "Unable to create secure media upload session", 500, undefined, false);
      }
      return { data: { asset, uploadSession: { assetId, storagePath, signedUploadUrl: signed.signedUrl, uploadToken: signed.token } }, status: 201 };
    }

    if (action === "cancel_upload") {
      assertNoUnknownFields(body, ["action", "assetId"]);
      const assetId = uuid(requiredString(body.assetId, "assetId", 36), "assetId", true)!;
      const asset = await findOwnedAsset(auth.organizationId, auth.user.id, assetId);
      const [reelRef, videoRef, sermonAudioRef, sermonVideoRef] = await Promise.all([
        admin.from("reels").select("id", { count: "exact", head: true }).eq("media_asset_id", assetId),
        admin.from("videos").select("id", { count: "exact", head: true }).eq("media_asset_id", assetId),
        admin.from("sermons").select("id", { count: "exact", head: true }).eq("audio_asset_id", assetId),
        admin.from("sermons").select("id", { count: "exact", head: true }).eq("video_asset_id", assetId),
      ]);
      const references = (reelRef.count ?? 0) + (videoRef.count ?? 0) + (sermonAudioRef.count ?? 0) + (sermonVideoRef.count ?? 0);
      if (references > 0) throw new ApiError("ASSET_IN_USE", "Published media cannot be cancelled", 409);
      if (asset.source_storage_path) await admin.storage.from(BUCKET).remove([asset.source_storage_path]);
      await admin.from("media_assets").delete().eq("id", assetId).eq("organization_id", auth.organizationId).eq("created_by", auth.user.id);
      return { data: { assetId, cancelled: true } };
    }

    if (action === "complete_upload") {
      assertNoUnknownFields(body, ["action", "assetId"]);
      const assetId = uuid(requiredString(body.assetId, "assetId", 36), "assetId", true)!;
      const asset = await findOwnedAsset(auth.organizationId, auth.user.id, assetId);
      if (asset.processing_state === "ready") return { data: asset };
      if (asset.processing_state !== "uploading" && asset.processing_state !== "uploaded") {
        throw new ApiError("ASSET_STATE_INVALID", "This media upload cannot be completed", 409);
      }
      if (!asset.source_storage_path) throw new ApiError("ASSET_STATE_INVALID", "Media asset has no source path", 409);

      const segments = asset.source_storage_path.split("/");
      const objectName = segments.pop()!;
      const directory = segments.join("/");
      const { data: objects, error: listError } = await admin.storage.from(BUCKET).list(directory, { limit: 20, search: objectName });
      if (listError) throw new ApiError("MEDIA_VERIFY_FAILED", "Unable to verify uploaded media", 500, undefined, false);
      const object = (objects ?? []).find((item) => item.name === objectName);
      if (!object) throw new ApiError("MEDIA_UPLOAD_INCOMPLETE", "The media file has not finished uploading", 409);
      const actualSize = Number((object as any).metadata?.size ?? asset.file_size_bytes ?? 0);
      if (!Number.isFinite(actualSize) || actualSize <= 0 || actualSize > MAX_BYTES) {
        await admin.storage.from(BUCKET).remove([asset.source_storage_path]);
        await admin.from("media_assets").update({ processing_state: "failed", processing_error: "Invalid uploaded file size" }).eq("id", assetId);
        throw new ApiError("PAYLOAD_TOO_LARGE", "Uploaded media exceeds the 200 MB limit", 413);
      }

      const mime = MIME_TYPES[asset.mime_type];
      if (!mime || mime.mediaType !== asset.media_type) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "Stored media metadata is invalid", 415);
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

      const { data: completed, error: completeError } = await admin.from("media_assets").update({
        processing_state: "ready",
        file_size_bytes: Math.round(actualSize),
        processing_error: null,
      }).eq("id", assetId).eq("organization_id", auth.organizationId).eq("created_by", auth.user.id)
        .select("id,organization_id,expression_id,media_type,processing_state,source_storage_path,mime_type,file_size_bytes,duration_seconds,aspect_ratio").single();
      if (completeError || !completed) throw new ApiError("ASSET_UPDATE_FAILED", "Unable to finalize media upload", 500, undefined, false);
      return { data: completed };
    }

    throw new ApiError("NOT_FOUND", "Endpoint action not recognized", 404);
  },
));