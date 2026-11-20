import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(createHandler(
  { methods: ["GET", "POST"], authentication: "required", organization: "required" },
  async ({ request, auth }) => {
    if (!auth?.organizationId || !auth.branchId) {
      throw new ApiError("EXPRESSION_REQUIRED", "Open the Expression before accessing its media.", 422);
    }

    const organizationId = auth.organizationId;
    const branchId = auth.branchId;
    const admin = adminClient();

    const { data: branch, error: branchError } = await admin
      .from("branches")
      .select("id,name,avatar_url,banner_url")
      .eq("id", branchId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (branchError || !branch) {
      throw new ApiError("EXPRESSION_NOT_FOUND", "This Expression is unavailable.", 404);
    }

    if (request.method === "GET") return { data: branch };

    const { data: allowed, error: permissionError } = await auth.client.rpc("has_permission", {
      target_organization_id: organizationId,
      requested_permission: "branches.update",
      target_branch_id: branchId,
    });

    if (permissionError || allowed !== true) {
      throw new ApiError("PERMISSION_DENIED", "You cannot edit this Expression.", 403);
    }

    const form = await request.formData();
    const kind = String(form.get("kind") ?? "");
    if (!["avatar", "banner"].includes(kind)) {
      throw new ApiError("VALIDATION_FAILED", "Choose avatar or banner media.", 422);
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError("VALIDATION_FAILED", "Choose an image to upload.", 422);
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new ApiError("VALIDATION_FAILED", "Use a JPG, PNG or WebP image.", 422);
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new ApiError("FILE_TOO_LARGE", "Expression images must be 8 MB or smaller.", 413);
    }

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${organizationId}/${branchId}/${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await admin.storage
      .from("expression-media")
      .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });

    if (uploadError) {
      throw new ApiError("EXPRESSION_MEDIA_UPLOAD_FAILED", "We couldn’t upload this Expression image.", 500, undefined, false);
    }

    const { data: publicData } = admin.storage.from("expression-media").getPublicUrl(path);
    const publicUrl = publicData.publicUrl;
    const column = kind === "avatar" ? "avatar_url" : "banner_url";
    const previousUrl = kind === "avatar" ? branch.avatar_url : branch.banner_url;

    const { data: updated, error: updateError } = await admin
      .from("branches")
      .update({ [column]: publicUrl })
      .eq("id", branchId)
      .eq("organization_id", organizationId)
      .select("id,name,avatar_url,banner_url")
      .single();

    if (updateError) {
      await admin.storage.from("expression-media").remove([path]);
      throw new ApiError("EXPRESSION_MEDIA_UPDATE_FAILED", "We couldn’t save this Expression image.", 500, undefined, false);
    }

    if (typeof previousUrl === "string" && previousUrl.includes("/storage/v1/object/public/expression-media/")) {
      const marker = "/storage/v1/object/public/expression-media/";
      const oldPath = decodeURIComponent(previousUrl.split(marker)[1] ?? "");
      if (oldPath) await admin.storage.from("expression-media").remove([oldPath]).catch(() => {});
    }

    return { data: updated, status: 201 };
  },
));
