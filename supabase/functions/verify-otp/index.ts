import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { EmailOtpType, MobileOtpType } from "npm:@supabase/supabase-js@2.57.4";
import { ApiError } from "../_shared/errors.ts";
import { createHandler } from "../_shared/handler.ts";
import { jsonBody } from "../_shared/request.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { publicClient } from "../_shared/supabase.ts";
import { assertNoUnknownFields, assertObject, email, phone, requiredString } from "../_shared/validation.ts";

const emailTypes = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);
const phoneTypes = new Set<MobileOtpType>(["sms", "phone_change"]);

Deno.serve(createHandler(
  { methods: ["POST"], authentication: "none", organization: "none" },
  async ({ request }) => {
    const body = assertObject(await jsonBody(request));
    assertNoUnknownFields(body, ["email", "phoneNumber", "token", "type"]);
    const submittedEmail = body.email === undefined ? undefined : email(body.email);
    const phoneNumber = body.phoneNumber === undefined ? undefined : phone(body.phoneNumber);
    if ((submittedEmail ? 1 : 0) + (phoneNumber ? 1 : 0) !== 1) throw new ApiError("VALIDATION_FAILED", "Provide exactly one identifier", 422);
    const token = requiredString(body.token, "token", 128);
    const type = requiredString(body.type, "type", 32);
    await enforceRateLimit(request, "verify-otp", submittedEmail ?? phoneNumber!, 8, 900);
    const client = publicClient();
    const result = submittedEmail && emailTypes.has(type as EmailOtpType)
      ? await client.auth.verifyOtp({ email: submittedEmail, token, type: type as EmailOtpType })
      : phoneNumber && phoneTypes.has(type as MobileOtpType)
      ? await client.auth.verifyOtp({ phone: phoneNumber, token, type: type as MobileOtpType })
      : null;
    if (!result) throw new ApiError("VALIDATION_FAILED", "OTP type is invalid for the identifier", 422);
    if (result.error || !result.data.user) throw new ApiError("INVALID_OTP", "The verification code is invalid or expired", 401);
    return {
      data: {
        status: "verified",
        userId: result.data.user.id,
        session: result.data.session ? {
          accessToken: result.data.session.access_token,
          refreshToken: result.data.session.refresh_token,
          expiresAt: result.data.session.expires_at,
          tokenType: result.data.session.token_type,
        } : null,
      },
    };
  },
));
