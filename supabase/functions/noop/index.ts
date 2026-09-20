import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { chatCallsHandler } from "../chat-calls/index.ts";
import { libraryHandler } from "../library/index.ts";

Deno.serve((request: Request) => {
  const service = new URL(request.url).searchParams.get("service");
  if (service === "calls") return chatCallsHandler(request);
  if (service === "library") return libraryHandler(request);
  return new Response(JSON.stringify({
    error: { code: "NOT_FOUND", message: "This endpoint is not available." },
  }), {
    status: 404,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
