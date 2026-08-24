import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json } from "../_shared/response.ts";

Deno.serve(() => {
  return json({
    service: "church-platform-api",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});
