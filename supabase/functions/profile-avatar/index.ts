import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { adminClient } from "../_shared/supabase.ts";

const MAX_BYTES = 5 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

Deno.serve(createHandler(
  { methods: ["POST", "DELETE"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    const admin = adminClient();

    if (request.method === "DELETE") {
      const prefix = `${auth.user.id}/`;
      const { data: existing, error: listError } = await admin.storage.from("profile-avatars").list(auth.user.id, { limit: 20 });
      if (listError) throw new ApiError("AVATAR_DELETE_FAILED", "Unable to inspect existing profile photo", 500, undefined, false);
      const paths = (existing ?? []).map((item) => `${prefix}${item.name}`);
      if (paths.length) {
        const { error: removeError } = await admin.storage.from("profile-avatars").remove(paths);
        if (removeError) throw new ApiError("AVATAR_DELETE_FAILED", "Unable to remove profile photo", 500, undefined, false);
      }
      const { error: profileError } = await admin.from("profiles").update({ avatar_url: null }).eq("id", auth.user.id);
      if (profileError) throw new ApiError("PROFILE_UPDATE_FAILED", "Profile photo was removed but the profile could not be updated", 500, undefined, false);
      return { data: { avatarUrl: null } };
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new ApiError("VALIDATION_FAILED", "Profile photo upload must use multipart form data", 415);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("VALIDATION_FAILED", "Choose a profile photo to upload", 422);
    if (!MIME_EXTENSIONS[file.type]) throw new ApiError("VALIDATION_FAILED", "Profile photo must be JPG, PNG, or WebP", 422);
    if (file.size <= 0 || file.size > MAX_BYTES) throw new ApiError("VALIDATION_FAILED", "Profile photo must be smaller than 5 MB", 422);

    const ext = MIME_EXTENSIONS[file.type];
    const path = `${auth.user.id}/avatar.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    // Remove older variants so each profile has one canonical avatar object.
    const { data: existing } = await admin.storage.from("profile-avatars").list(auth.user.id, { limit: 20 });
    const stalePaths = (existing ?? []).map((item) => `${auth.user.id}/${item.name}`).filter((item) => item !== path);
    if (stalePaths.length) await admin.storage.from("profile-avatars").remove(stalePaths);

    const { error: uploadError } = await admin.storage.from("profile-avatars").upload(path, bytes, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });
    if (uploadError) throw new ApiError("AVATAR_UPLOAD_FAILED", "Unable to upload profile photo", 500, undefined, false);

    const { data: publicData } = admin.storage.from("profile-avatars").getPublicUrl(path);
    // Cache busting is safe because the canonical storage object is still stable.
    const avatarUrl = `${publicData.publicUrl}?v=${Date.now()}`;
    const { error: profileError } = await admin.from("profiles").update({ avatar_url: avatarUrl }).eq("id", auth.user.id);
    if (profileError) throw new ApiError("PROFILE_UPDATE_FAILED", "Photo uploaded but profile update failed", 500, undefined, false);

    return { data: { avatarUrl } };
  },
));
