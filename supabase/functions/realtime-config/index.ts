import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-request-id",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=300",
  "Content-Type": "application/json; charset=utf-8",
};

function required(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

Deno.serve((request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }), {
      status: 405,
      headers,
    });
  }

  try {
    // The anonymous/publishable key is intentionally public client
    // configuration. Service-role and provider secrets are never returned.
    return new Response(JSON.stringify({
      data: {
        url: required("SUPABASE_URL"),
        anonKey: required("SUPABASE_ANON_KEY"),
      },
    }), { status: 200, headers });
  } catch (error) {
    console.error("realtime-config failed", error);
    return new Response(JSON.stringify({
      error: { code: "REALTIME_CONFIG_UNAVAILABLE", message: "Realtime is temporarily unavailable." },
    }), { status: 503, headers });
  }
});
