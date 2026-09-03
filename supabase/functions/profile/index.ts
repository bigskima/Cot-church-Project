import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { assertNoUnknownFields, assertObject, optionalString } from "../_shared/validation.ts";

function normalizedUsername(value: unknown) {
  const raw = optionalString(value, "username", 30);
  if (raw === undefined) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._]{2,29}$/.test(normalized)) {
    throw new ApiError("VALIDATION_FAILED", "Username must be 3-30 characters using letters, numbers, dots or underscores", 422, {
      username: "Use 3-30 lowercase letters, numbers, dots or underscores",
    });
  }
  return normalized;
}

function normalizedBirthday(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError("VALIDATION_FAILED", "Birthday must use YYYY-MM-DD", 422);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || parsed > new Date() || parsed < new Date("1900-01-01T00:00:00Z")) {
    throw new ApiError("VALIDATION_FAILED", "Birthday is invalid", 422);
  }
  return value;
}

Deno.serve(createHandler(
  { methods: ["GET", "PATCH"], authentication: "required", organization: "none" },
  async ({ request, auth }) => {
    if (!auth) throw new ApiError("AUTHENTICATION_REQUIRED", "Authentication required", 401);

    if (request.method === "PATCH") {
      const body = assertObject(await jsonBody(request));
      assertNoUnknownFields(body, ["displayName", "username", "birthday", "birthdayExpressionVisible", "birthdayPublicVisible", "bio", "phoneNumber"]);
      const displayName = optionalString(body.displayName, "displayName", 120);
      const username = normalizedUsername(body.username);
      const birthday = normalizedBirthday(body.birthday);
      const bio = body.bio === null ? null : optionalString(body.bio, "bio", 500);
      const phoneNumber = body.phoneNumber === null ? null : optionalString(body.phoneNumber, "phoneNumber", 32);
      if (body.birthdayExpressionVisible !== undefined && typeof body.birthdayExpressionVisible !== "boolean") {
        throw new ApiError("VALIDATION_FAILED", "birthdayExpressionVisible must be boolean", 422);
      }
      if (body.birthdayPublicVisible !== undefined && typeof body.birthdayPublicVisible !== "boolean") {
        throw new ApiError("VALIDATION_FAILED", "birthdayPublicVisible must be boolean", 422);
      }

      const updates: Record<string, unknown> = {};
      if (displayName !== undefined) {
        if (!displayName.trim()) throw new ApiError("VALIDATION_FAILED", "Full name is required", 422);
        updates.display_name = displayName.trim();
      }
      if (username !== undefined) updates.username = username;
      if (birthday !== undefined) updates.birthday = birthday;
      if (body.birthdayExpressionVisible !== undefined) updates.birthday_expression_visible = body.birthdayExpressionVisible;
      if (body.birthdayPublicVisible !== undefined) updates.birthday_public_visible = body.birthdayPublicVisible;
      if (bio !== undefined) updates.bio = bio?.trim() || null;
      if (phoneNumber !== undefined) updates.phone_number = phoneNumber?.trim() || null;
      if (!Object.keys(updates).length) throw new ApiError("VALIDATION_FAILED", "At least one profile field is required", 422);

      const { error } = await auth.client.from("profiles").update(updates).eq("id", auth.user.id);
      if (error?.code === "23505") throw new ApiError("USERNAME_TAKEN", "That username is already in use", 409, { username: "Choose another username" });
      if (error) throw new ApiError("PROFILE_UPDATE_FAILED", "Unable to update profile", 500, undefined, false);
    }

    const { data: profile, error } = await auth.client
      .from("profiles")
      .select("id,display_name,username,birthday,birthday_expression_visible,birthday_public_visible,bio,phone_number,avatar_url,created_at,updated_at")
      .eq("id", auth.user.id)
      .single();
    if (error || !profile) throw new ApiError("PROFILE_NOT_FOUND", "Profile was not found", 404);

    return {
      data: {
        ...profile,
        email: auth.user.email ?? null,
        verifiedPhoneNumber: auth.user.phone ?? null,
      },
    };
  },
));