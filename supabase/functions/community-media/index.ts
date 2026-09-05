import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const BUCKET = "community-public-media";
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_MEMBER_PUBLIC_VIDEO_SECONDS = 180;
const MIME_TYPES: Record<string, { kind: "image" | "video" | "audio"; ext: string }> = {
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/png": { kind: "image", ext: "png" },
  "image/webp": { kind: "image", ext: "webp" },
  "image/gif": { kind: "image", ext: "gif" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/webm": { kind: "video", ext: "webm" },
  "video/quicktime": { kind: "video", ext: "mov" },
  "audio/mpeg": { kind: "audio", ext: "mp3" },
  "audio/mp4": { kind: "audio", ext: "m4a" },
  "audio/aac": { kind: "audio", ext: "aac" },
  "audio/ogg": { kind: "audio", ext: "ogg" },
  "audio/wav": { kind: "audio", ext: "wav" },
};

function positiveSize(value: unknown) {
  const size = Number(value);
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "Community media must be 50 MB or smaller", 413);
  }
  return size;
}

function fileLabel(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, 255);
}

function durationSeconds(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 0 || duration > 86400) {
    throw new ApiError("VALIDATION_FAILED", "Video duration is invalid", 422);
  }
  return Math.round(duration);
}

Deno.serve(createHandler(
  { methods: ["POST", "DELETE"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.user || !auth.organizationId || !auth.membershipId) {
      throw new ApiError("MEMBERSHIP_REQUIRED", "Join an Expression before publishing community media", 403);
    }

    const { data: postingAllowed, error: postingError } = await auth.client.rpc("can_profile_post", {
      target_profile_id: auth.user.id,
    });
    if (postingError || postingAllowed !== true) {
      throw new ApiError("POSTING_RESTRICTED", "Your posting access is currently restricted", 403);
    }

    const admin = adminClient();
    const body = assertObject(await jsonBody(request));

    if (request.method === "DELETE") {
      assertNoUnknownFields(body, ["uploadId"]);
      const uploadId = uuid(requiredString(body.uploadId, "uploadId", 36), "uploadId", true)!;
      const { data: upload, error: lookupError } = await admin
        .from("social_media_uploads")
        .select("id,storage_path,status")
        .eq("id", uploadId)
        .eq("organization_id", auth.organizationId)
        .eq("uploader_profile_id", auth.user.id)
        .maybeSingle();
      if (lookupError || !upload) throw new ApiError("UPLOAD_NOT_FOUND", "Media upload not found", 404);
      if (upload.status === "attached") throw new ApiError("UPLOAD_ALREADY_ATTACHED", "Media already belongs to a published post", 409);
      if (upload.status !== "deleted") {
        await admin.storage.from(BUCKET).remove([upload.storage_path]);
        const { error: updateError } = await admin.from("social_media_uploads").update({
          status: "deleted",
          deleted_at: new Date().toISOString(),
        }).eq("id", upload.id);
        if (updateError) throw new ApiError("MEDIA_DELETE_FAILED", "Unable to remove media", 500, undefined, false);
      }
      return { data: { uploadId, deleted: true } };
    }

    const action = requiredString(body.action, "action", 32);
    if (action === "create_upload") {
      assertNoUnknownFields(body, ["action", "mimeType", "fileName", "sizeBytes", "branchId", "durationSeconds"]);
      const mimeType = requiredString(body.mimeType, "mimeType", 120).toLowerCase();
      const type = MIME_TYPES[mimeType];
      if (!type) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "This image, video, or audio format is not supported", 415);
      const sizeBytes = positiveSize(body.sizeBytes);
      const branchId = body.branchId ? uuid(String(body.branchId), "branchId", true)! : null;
      const declaredDurationSeconds = type.kind === "video" ? durationSeconds(body.durationSeconds) : null;

      if (branchId && branchId !== auth.branchId) {
        throw new ApiError("EXPRESSION_SCOPE_DENIED", "Media can only be uploaded for your selected Expression", 403);
      }

      const { data: elevatedPublisher, error: permissionError } = await auth.client.rpc("has_permission", {
        target_organization_id: auth.organizationId,
        requested_permission: "feed.post",
        target_branch_id: branchId,
      });
      if (permissionError) {
        throw new ApiError("PERMISSION_CHECK_FAILED", "Unable to validate community publishing access", 500, undefined, false);
      }

      if (!branchId && elevatedPublisher !== true) {
        const { data: memberships, error: membershipError } = await admin
          .from("expression_memberships")
          .select("id,branch:branches!inner(is_active)")
          .eq("organization_id", auth.organizationId)
          .eq("profile_id", auth.user.id)
          .eq("status", "active")
          .eq("branch.is_active", true)
          .limit(1);
        if (membershipError) {
          throw new ApiError("MEMBERSHIP_LOOKUP_FAILED", "Unable to validate Expression membership", 500, undefined, false);
        }
        if (!(memberships ?? []).length) {
          throw new ApiError("EXPRESSION_MEMBERSHIP_REQUIRED", "Join an active Expression before posting in General Community", 403);
        }
        if (type.kind === "audio") {
          throw new ApiError(
            "GENERAL_MEDIA_RESTRICTED",
            "General Community member posts support text, images and short videos. Audio ministry content requires an authorized publishing workflow.",
            403,
          );
        }
        if (
          type.kind === "video" &&
          (!declaredDurationSeconds || declaredDurationSeconds > MAX_MEMBER_PUBLIC_VIDEO_SECONDS)
        ) {
          throw new ApiError(
            "GENERAL_VIDEO_TOO_LONG",
            "General Community member videos must be 3 minutes or shorter",
            422,
          );
        }
      }

      const uploadId = crypto.randomUUID();
      const storagePath = `orgs/${auth.organizationId}/social/${auth.user.id}/${uploadId}.${type.ext}`;
      const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
      const { error: recordError } = await admin.from("social_media_uploads").insert({
        id: uploadId,
        organization_id: auth.organizationId,
        branch_id: branchId,
        uploader_profile_id: auth.user.id,
        media_kind: type.kind,
        mime_type: mimeType,
        storage_path: storagePath,
        public_url: publicData.publicUrl,
        original_filename: fileLabel(body.fileName),
        size_bytes: sizeBytes,
        duration_seconds: declaredDurationSeconds,
        status: "pending",
      });
      if (recordError) throw new ApiError("MEDIA_UPLOAD_INTENT_FAILED", "Unable to prepare media upload", 500, undefined, false);

      const { data: signed, error: signedError } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
      if (signedError || !signed) {
        await admin.from("social_media_uploads").delete().eq("id", uploadId);
        throw new ApiError("MEDIA_UPLOAD_INTENT_FAILED", "Unable to create secure media upload URL", 500, undefined, false);
      }

      return {
        data: {
          uploadId,
          type: type.kind,
          mimeType,
          sizeBytes,
          durationSeconds: declaredDurationSeconds,
          signedUploadUrl: signed.signedUrl,
          uploadToken: signed.token,
          storagePath: signed.path,
        },
        status: 201,
      };
    }

    if (action === "complete_upload") {
      assertNoUnknownFields(body, ["action", "uploadId"]);
      const uploadId = uuid(requiredString(body.uploadId, "uploadId", 36), "uploadId", true)!;
      const { data: upload, error: lookupError } = await admin
        .from("social_media_uploads")
        .select("id,media_kind,mime_type,storage_path,public_url,original_filename,size_bytes,duration_seconds,status")
        .eq("id", uploadId)
        .eq("organization_id", auth.organizationId)
        .eq("uploader_profile_id", auth.user.id)
        .maybeSingle();
      if (lookupError || !upload) throw new ApiError("UPLOAD_NOT_FOUND", "Media upload not found", 404);
      if (upload.status === "attached" || upload.status === "uploaded") {
        return {
          data: {
            uploadId: upload.id,
            type: upload.media_kind,
            mimeType: upload.mime_type,
            url: upload.public_url,
            fileName: upload.original_filename,
            sizeBytes: Number(upload.size_bytes),
            durationSeconds: upload.duration_seconds == null ? null : Number(upload.duration_seconds),
          },
        };
      }
      if (upload.status !== "pending") throw new ApiError("UPLOAD_UNAVAILABLE", "This media upload is no longer available", 409);

      const segments = upload.storage_path.split("/");
      const objectName = segments.pop()!;
      const directory = segments.join("/");
      const { data: objects, error: listError } = await admin.storage.from(BUCKET).list(directory, { limit: 20, search: objectName });
      if (listError) throw new ApiError("MEDIA_VERIFY_FAILED", "Unable to verify uploaded media", 500, undefined, false);
      const object = (objects ?? []).find((item) => item.name === objectName);
      if (!object) throw new ApiError("MEDIA_UPLOAD_INCOMPLETE", "The media file has not finished uploading", 409);
      const actualSize = Number((object as any).metadata?.size ?? upload.size_bytes);
      if (!Number.isFinite(actualSize) || actualSize <= 0 || actualSize > MAX_BYTES) {
        await admin.storage.from(BUCKET).remove([upload.storage_path]);
        await admin.from("social_media_uploads").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", upload.id);
        throw new ApiError("PAYLOAD_TOO_LARGE", "Uploaded media exceeds the 50 MB limit", 413);
      }

      const { data: completed, error: completeError } = await admin.from("social_media_uploads").update({
        status: "uploaded",
        size_bytes: Math.round(actualSize),
      }).eq("id", upload.id).eq("status", "pending")
        .select("id,media_kind,mime_type,public_url,original_filename,size_bytes,duration_seconds")
        .single();
      if (completeError || !completed) throw new ApiError("MEDIA_VERIFY_FAILED", "Unable to finalize uploaded media", 500, undefined, false);

      return {
        data: {
          uploadId: completed.id,
          type: completed.media_kind,
          mimeType: completed.mime_type,
          url: completed.public_url,
          fileName: completed.original_filename,
          sizeBytes: Number(completed.size_bytes),
          durationSeconds: completed.duration_seconds == null ? null : Number(completed.duration_seconds),
        },
      };
    }

    throw new ApiError("VALIDATION_FAILED", "Unsupported community media action", 422);
  },
));
