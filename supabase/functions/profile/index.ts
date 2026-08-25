import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);
    if (request.method === "PATCH") {
      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["displayName", "avatarUrl"]);
      const displayName = optionalString(body.displayName, "displayName", 120);
      const avatarUrl = optionalString(body.avatarUrl, "avatarUrl", 2048);
      if (displayName === undefined && avatarUrl === undefined) throw new ApiError("VALIDATION_FAILED", "At least one profile field is required", 422);
      const updates = {
        ...(displayName !== undefined ? { display_name: displayName } : {}),
        ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
      };
      const { error } = await auth.client.from("profiles").update(updates).eq("id", auth.user.id);
      if (error) throw new ApiError("PROFILE_UPDATE_FAILED", "Unable to update profile", 500, undefined, false);
    }
    const { data: profile, error } = await auth.client.from("profiles").select("id, display_name, phone_number, avatar_url, created_at, updated_at").eq("id", auth.user.id).single();
    if (error || !profile) throw new ApiError("PROFILE_NOT_FOUND", "Profile was not found", 404);
    return { data: { ...profile, email: auth.user.email ?? null, verifiedPhoneNumber: auth.user.phone ?? null } };
  },
));
