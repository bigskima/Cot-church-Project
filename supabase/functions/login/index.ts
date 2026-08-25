import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { publicClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, email, phone, requiredString } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["POST"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["email", "phoneNumber", "password"]);
    const submittedEmail = body.email === undefined ? undefined : email(body.email);
    const phoneNumber = body.phoneNumber === undefined ? undefined : phone(body.phoneNumber);
    if ((submittedEmail ? 1 : 0) + (phoneNumber ? 1 : 0) !== 1) {
      throw new ApiError("VALIDATION_FAILED", "Provide exactly one email or phone number", 422);
    }
    const submittedPassword = requiredString(body.password, "password", 128);
    await enforceRateLimit(request, "login", submittedEmail ?? phoneNumber!, 10, 900);
    const client = publicClient();
    const { data, error } = submittedEmail
      ? await client.auth.signInWithPassword({ email: submittedEmail, password: submittedPassword })
      : await client.auth.signInWithPassword({ phone: phoneNumber!, password: submittedPassword });
    if (error || !data.session || !data.user) {
      throw new ApiError("INVALID_CREDENTIALS", "The supplied credentials are invalid", 401);
    }
    return {
      data: {
        user: { id: data.user.id, email: data.user.email, phoneNumber: data.user.phone },
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
          tokenType: data.session.token_type,
        },
      },
    };
  },
));
