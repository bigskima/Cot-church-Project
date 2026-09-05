import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { adminClient, publicClient } from "../_shared/supabase.ts";
import {
  assertNoUnknownFields,
  assertObject,
  email,
  optionalString,
  phone,
  requiredString,
} from "../_shared/validation.ts";

function username(value: unknown) {
  const normalized = requiredString(value, "username", 30).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._]{2,29}$/.test(normalized)) {
    throw new ApiError("VALIDATION_FAILED", "Username must be 3-30 characters using letters, numbers, dots or underscores", 422, {
      username: "Use 3-30 lowercase letters, numbers, dots or underscores",
    });
  }
  return normalized;
}

function birthday(value: unknown) {
  const raw = requiredString(value, "birthday", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new ApiError("VALIDATION_FAILED", "Birthday must use YYYY-MM-DD", 422);
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) throw new ApiError("VALIDATION_FAILED", "Birthday is invalid", 422);
  const now = new Date();
  const earliest = new Date("1900-01-01T00:00:00Z");
  if (parsed > now || parsed < earliest) throw new ApiError("VALIDATION_FAILED", "Birthday is outside the supported range", 422);
  return raw;
}

Deno.serve(createHandler(
  { methods: ["POST"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const body = assertObject(await jsonBody(request));
    // fullName is accepted temporarily for compatibility with older deployed clients.
    assertNoUnknownFields(body, ["email", "phoneNumber", "password", "displayName", "fullName", "username", "birthday", "bio"]);
    const submittedEmail = body.email === undefined || body.email === "" ? undefined : email(body.email);
    const phoneNumber = body.phoneNumber === undefined || body.phoneNumber === "" ? undefined : phone(body.phoneNumber);
    if (!submittedEmail && !phoneNumber) {
      throw new ApiError("VALIDATION_FAILED", "Provide an email address or phone number", 422, {
        identity: "An authentication identifier is required",
      });
    }

    const displayName = requiredString(body.displayName ?? body.fullName, "displayName", 120).trim();
    const submittedUsername = username(body.username);
    const submittedBirthday = birthday(body.birthday);
    const bio = optionalString(body.bio, "bio", 500) ?? null;

    await enforceRateLimit(request, "signup", submittedEmail ?? phoneNumber!, 5, 3600);

    const admin = adminClient();
    const { data: existingUsername, error: usernameError } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", submittedUsername)
      .limit(1)
      .maybeSingle();
    if (usernameError) throw new ApiError("USERNAME_CHECK_FAILED", "Unable to validate username availability", 503, undefined, false);
    if (existingUsername) throw new ApiError("USERNAME_TAKEN", "That username is already in use", 409, { username: "Choose another username" });

    if (typeof body.password !== "string" || body.password.length === 0) {
      throw new ApiError("VALIDATION_FAILED", "A password is required", 422, { password: "Enter a password" });
    }
    // Password complexity/length is intentionally not duplicated here.
    // Supabase Auth project configuration is the single policy authority.
    const submittedPassword = body.password;
    const metadata = {
      display_name: displayName,
      username: submittedUsername,
      birthday: submittedBirthday,
      bio,
      // If email is the login identity, phone remains an editable profile contact until separately verified.
      profile_phone: submittedEmail ? phoneNumber ?? null : null,
    };

    const client = publicClient();
    const { data, error } = submittedEmail
      ? await client.auth.signUp({ email: submittedEmail, password: submittedPassword, options: { data: metadata } })
      : await client.auth.signUp({ phone: phoneNumber!, password: submittedPassword, options: { data: metadata, channel: "sms" } });

    if (error) {
      if (error.status && error.status >= 500) {
        throw new ApiError("IDENTITY_PROVIDER_UNAVAILABLE", "Registration is temporarily unavailable", 503);
      }

      // Supabase Auth owns the password policy. Surface only password-policy
      // rejections so the user can satisfy the currently configured policy.
      const authCode = typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : "";
      if (authCode === "weak_password" || /password/i.test(error.message)) {
        throw new ApiError("PASSWORD_POLICY_REJECTED", error.message, 422, undefined, true);
      }

      // Other auth-provider responses remain enumeration-resistant.
      return { data: { status: "verification_required" }, status: 202 };
    }

    return {
      data: { status: data.session ? "active" : "verification_required" },
      status: data.session ? 201 : 202,
    };
  },
));
