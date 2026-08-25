import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { publicClient } from "../_shared/supabase.ts";
import {
  assertNoUnknownFields,
  assertObject,
  email,
  optionalString,
  password,
  phone,
} from "../_shared/validation.ts";

Deno.serve(createHandler(
  { methods: ["POST"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["email", "phoneNumber", "password", "displayName"]);
    const submittedEmail = body.email === undefined ? undefined : email(body.email);
    const phoneNumber = body.phoneNumber === undefined ? undefined : phone(body.phoneNumber);
    if ((submittedEmail ? 1 : 0) + (phoneNumber ? 1 : 0) !== 1) {
      throw new ApiError("VALIDATION_FAILED", "Provide exactly one email or phone number", 422, {
        identity: "Exactly one authentication identifier is required",
      });
    }
    await enforceRateLimit(request, "signup", submittedEmail ?? phoneNumber!, 5, 3600);
    const submittedPassword = password(body.password);
    const displayName = optionalString(body.displayName, "displayName", 120);
    const client = publicClient();
    const { data, error } = submittedEmail
      ? await client.auth.signUp({ email: submittedEmail, password: submittedPassword, options: { data: { display_name: displayName } } })
      : await client.auth.signUp({ phone: phoneNumber!, password: submittedPassword, options: { data: { display_name: displayName }, channel: "sms" } });
    if (error) {
      // Keep the public response enumeration-resistant while retaining the request ID in logs.
      if (error.status && error.status >= 500) throw new ApiError("IDENTITY_PROVIDER_UNAVAILABLE", "Registration is temporarily unavailable", 503);
      return { data: { status: "verification_required" }, status: 202 };
    }
    return {
      data: {
        status: data.session ? "active" : "verification_required",
      },
      status: data.session ? 201 : 202,
    };
  },
));
