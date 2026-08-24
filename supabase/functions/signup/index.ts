import "jsr:@supabase/functions-js/dist/edge-runtime.d.ts";
import { json, error } from "../_shared/api.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return error("Method not allowed", 405);

  const body = await req.json();
  const email = body.email;
  const mobileNumber = body.mobileNumber;

  if (!email || !mobileNumber) {
    return error("Email and mobile number are required");
  }

  return json({
    status: "accepted",
    message: "Registration request received",
    identifiers: { email, mobileNumber },
  });
});
