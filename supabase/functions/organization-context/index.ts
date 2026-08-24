import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json } from "../_shared/response.ts";

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Organization context will be resolved from authenticated claims
  // and database-backed tenancy rules. No organization IDs are hardcoded.
  return json({
    endpoint: "organization-context",
    status: "ready",
    message: "Context resolution is database driven",
  });
});
