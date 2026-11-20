import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getPasswordRecoveryRedirectUrl } from "../_shared/config.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { publicClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, email } from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["POST"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["email"]);
    const submittedEmail = email(body.email);
    await enforceRateLimit(request, "password-recovery", submittedEmail, 3, 3600);
    await publicClient().auth.resetPasswordForEmail(submittedEmail, { redirectTo: getPasswordRecoveryRedirectUrl() });
    // Always return the same response to prevent account enumeration.
    return { data: { status: "accepted" }, status: 202 };
  },
));
