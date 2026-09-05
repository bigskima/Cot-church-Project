import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { adminClient, publicClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString } from "../_shared/validation.ts";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new ApiError("RECOVERY_SESSION_REQUIRED", "Open the password-reset link from your email to continue.", 401);
  return match[1];
}

Deno.serve(createHandler(
  { methods: ["POST"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const token = bearerToken(request);
    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["password"]);
    const password = requiredString(body.password, "password", 512);

    // Validate the recovery access token with Supabase Auth before performing
    // any privileged update. The client never receives service credentials.
    const { data: userData, error: userError } = await publicClient().auth.getUser(token);
    if (userError || !userData.user) {
      throw new ApiError("RECOVERY_SESSION_INVALID", "This password-reset link is invalid or has expired.", 401);
    }

    // Password acceptance remains owned by the configured Supabase Auth policy.
    // Do not duplicate length/complexity rules in the mobile/web client.
    const { error: updateError } = await adminClient().auth.admin.updateUserById(userData.user.id, { password });
    if (updateError) {
      const message = /password/i.test(updateError.message)
        ? updateError.message
        : "Unable to update your password.";
      throw new ApiError("PASSWORD_RESET_FAILED", message, 422);
    }

    return { data: { status: "updated" } };
  },
));
