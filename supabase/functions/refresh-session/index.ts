import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { publicClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, requiredString } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["POST"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["refreshToken"]);
    const refreshToken = requiredString(body.refreshToken, "refreshToken", 4096);

    // The rate-limit key is hashed with the server-side pepper before storage.
    // The raw refresh token is never persisted by the limiter.
    await enforceRateLimit(request, "refresh-session", refreshToken, 20, 900);

    const client = publicClient();
    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session || !data.user) {
      throw new ApiError(
        "INVALID_REFRESH_SESSION",
        "Your session has expired. Please sign in again.",
        401,
      );
    }

    return {
      data: {
        userId: data.user.id,
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
