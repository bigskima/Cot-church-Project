import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString, uuid } from "../_shared/validation.ts";

const BUCKET = "community-public-media";
const MAX_BYTES = 50 * 1024 * 1024;
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

    if (request.method === "DELETE") {
      const body = assertObject(await jsonBody(request));
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
        const { error: removeError } = await admin.storage.from(BUCKET).remove([upload.storage_path]);
        if (removeError) throw new ApiError("MEDIA_DELETE_FAILED", "Unable to remove media", 500, undefined, false);
        const { error: updateError } = await admin.from("social_media_uploads").update({
          status: "deleted",
          deleted_at: new Date().toISOString(),
        }).eq("id", upload.id);
        if (updateError) throw new ApiError("MEDIA_DELETE_FAILED", "Media removed but upload state could not be updated", 500, undefined, false);
      }
      return { data: { uploadId, deleted: true } };
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "Community media upload must use multipart form data", 415);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("VALIDATION_FAILED", "Choose an image, video, or audio file", 422);
    const type = MIME_TYPES[file.type];
    if (!type) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", "This image, video, or audio format is not supported", 415);
    if (file.size <= 0 || file.size > MAX_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE", "Community media must be 50 MB or smaller", 413);

    const rawBranchId = form.get("branchId");
    const branchId = typeof rawBranchId === "string" && rawBranchId.trim()
      ? uuid(rawBranchId.trim(), "branchId", true)!
      : null;
    if (branchId && branchId !== auth.branchId) {
      throw new ApiError("EXPRESSION_SCOPE_DENIED", "Media can only be uploaded for your selected Expression", 403);
    }

    const uploadId = crypto.randomUUID();
    const storagePath = `orgs/${auth.organizationId}/social/${auth.user.id}/${uploadId}.${type.ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
      cacheControl: "31536000",
    });
    if (uploadError) throw new ApiError("MEDIA_UPLOAD_FAILED", "Unable to upload community media", 500, undefined, false);

    const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicData.publicUrl;
    const { data: record, error: recordError } = await admin.from("social_media_uploads").insert({
      id: uploadId,
      organization_id: auth.organizationId,
      branch_id: branchId,
      uploader_profile_id: auth.user.id,
      media_kind: type.kind,
      mime_type: file.type,
      storage_path: storagePath,
      public_url: publicUrl,
      original_filename: file.name?.slice(0, 255) || null,
      size_bytes: file.size,
    }).select("id,media_kind,mime_type,public_url,original_filename,size_bytes,status").single();

    if (recordError || !record) {
      await admin.storage.from(BUCKET).remove([storagePath]);
      throw new ApiError("MEDIA_UPLOAD_FAILED", "Media uploaded but could not be registered", 500, undefined, false);
    }

    return {
      data: {
        uploadId: record.id,
        type: record.media_kind,
        mimeType: record.mime_type,
        url: record.public_url,
        fileName: record.original_filename,
        sizeBytes: Number(record.size_bytes),
      },
      status: 201,
    };
  },
));
